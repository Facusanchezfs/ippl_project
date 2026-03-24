'use strict';

const cron = require('node-cron');
const { generateRecurringAppointments } = require('../services/recurringGenerationService');
const logger = require('../utils/logger');
const { Appointment, sequelize } = require('../../models');
const { Op } = require('sequelize');
const {
  buildBalanceSnapshot,
  computeRemainingBalanceAttended,
  applyProfessionalBalanceForTransition,
} = require('../services/appointmentFinancialEffectsService');
const {
  getArgentinaCivilDateString,
  getArgentinaTimeHHMM,
  getArgentinaWeekdayLongEs,
} = require('../utils/civilDateUtils');

/** Citas procesadas por iteración (transacción atómica por cita, lote para throttling). */
const COMPLETE_BATCH_SIZE = 75;

/**
 * Minutos después de `endTime` (misma fecha civil que la cita) para marcar completed.
 * Evita cerrar el turno mientras sigue vigente el horario de fin.
 */
const AUTO_COMPLETE_AFTER_END_MIN = 5;

/**
 * A partir de esta hora civil AR (lun–sáb) se procesan citas de **días anteriores**
 * que sigan `scheduled`. Evita el efecto "a las 00:03 de la madrugada cerró todo ayer".
 */
const BACKLOG_EARLIEST_MINUTES = 9 * 60;

function toMinutes(hhmm) {
  const [h, m] = String(hhmm || '')
    .split(':')
    .map((x) => parseInt(x, 10));
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

function hasValidTimeOrder(startTime, endTime) {
  if (!startTime || !endTime) return false;
  return toMinutes(endTime) > toMinutes(startTime);
}

function appointmentDateToYmd(dateVal) {
  if (dateVal == null || dateVal === '') return '';
  const s = String(dateVal);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/** Domingo civil AR: no se liquida backlog de días previos (hasta el lunes ≥ 09:00). */
function isSundayArgentina(now) {
  const w = getArgentinaWeekdayLongEs(now).toLowerCase();
  return w === 'domingo';
}

/**
 * ¿Puede esta cita pasar a `completed` en el instante `now` (hora civil AR)?
 *
 * - Mismo día: solo si ya pasó `endTime` + margen (no usar `startTime`).
 * - Días anteriores (backlog): solo lun–sáb y desde las 09:00 AR (no madrugada ni domingo).
 */
function isDueForAutoComplete(appointmentDateYmd, startTime, endTime, now) {
  const todayStr = getArgentinaCivilDateString(now);
  const nowMin = toMinutes(getArgentinaTimeHHMM(now));

  if (!hasValidTimeOrder(startTime, endTime)) return false;
  if (appointmentDateYmd > todayStr) return false;

  if (appointmentDateYmd < todayStr) {
    if (isSundayArgentina(now)) return false;
    return nowMin >= BACKLOG_EARLIEST_MINUTES;
  }

  const dueMin = toMinutes(endTime) + AUTO_COMPLETE_AFTER_END_MIN;
  return nowMin >= dueMin;
}

/**
 * Auto-completar citas `scheduled` según regla de negocio (fin de turno + ventanas de backlog).
 * Transición atómica: `findOne ... FOR UPDATE` + `save` solo si sigue `scheduled` y sigue `isDue`.
 */
async function completeDueAppointments() {
  const now = new Date();
  const todayStr = getArgentinaCivilDateString(now);

  const where = {
    active: true,
    status: 'scheduled',
    date: { [Op.lte]: todayStr },
  };

  const candidates = await Appointment.findAll({
    where,
    attributes: ['id', 'date', 'startTime', 'endTime'],
  });

  const validIds = [];
  let skippedMissingTimes = 0;
  let skippedInvalidOrder = 0;
  let skippedNotDue = 0;

  for (const appt of candidates) {
    const { id, date, startTime, endTime } = appt;
    const ymd = appointmentDateToYmd(date);

    if (!startTime || !endTime) {
      skippedMissingTimes++;
      logger.debug(
        `[RecurringCron] Skipping appointment ${id} (missing startTime/endTime)`
      );
      continue;
    }

    if (!hasValidTimeOrder(startTime, endTime)) {
      skippedInvalidOrder++;
      logger.debug(
        `[RecurringCron] Skipping appointment ${id} (invalid time order: startTime=${startTime}, endTime=${endTime})`
      );
      continue;
    }

    if (!isDueForAutoComplete(ymd, startTime, endTime, now)) {
      skippedNotDue++;
      continue;
    }

    validIds.push(id);
  }

  let transitioned = 0;
  let skippedRace = 0;
  let skippedInvalidUnderLock = 0;
  let skippedNotDueUnderLock = 0;
  let errorCount = 0;

  for (let i = 0; i < validIds.length; i += COMPLETE_BATCH_SIZE) {
    const batch = validIds.slice(i, i + COMPLETE_BATCH_SIZE);

    for (const id of batch) {
      try {
        await sequelize.transaction(async (t) => {
          const row = await Appointment.findOne({
            where: { id, active: true, status: 'scheduled' },
            transaction: t,
            lock: t.LOCK.UPDATE,
          });

          if (!row) {
            skippedRace++;
            logger.debug(
              `[RecurringCron] Auto-complete skip id=${id} reason=no_scheduled_row (affectedRows=0)`
            );
            return;
          }

          const ymd = appointmentDateToYmd(row.date);
          if (
            !isDueForAutoComplete(
              ymd,
              row.startTime,
              row.endTime,
              new Date()
            )
          ) {
            skippedNotDueUnderLock++;
            logger.debug(
              `[RecurringCron] Auto-complete skip id=${id} reason=not_due_under_lock`
            );
            return;
          }

          if (!row.startTime || !row.endTime) {
            skippedInvalidUnderLock++;
            logger.debug(
              `[RecurringCron] Auto-complete skip id=${id} reason=missing_times_under_lock startTime=${row.startTime} endTime=${row.endTime}`
            );
            return;
          }

          const startMin = toMinutes(row.startTime);
          const endMin = toMinutes(row.endTime);
          if (!(endMin > startMin)) {
            skippedInvalidUnderLock++;
            logger.debug(
              `[RecurringCron] Auto-complete skip id=${id} reason=invalid_times_under_lock startTime=${row.startTime} endTime=${row.endTime} startMin=${startMin} endMin=${endMin}`
            );
            return;
          }

          const beforeSnapshot = buildBalanceSnapshot(row);
          const remainingBalance = computeRemainingBalanceAttended(row);

          row.set({
            status: 'completed',
            attended: true,
            remainingBalance,
          });

          await row.save({
            transaction: t,
            validate: false,
          });

          const afterSnapshot = buildBalanceSnapshot(row);
          const { deltas } = await applyProfessionalBalanceForTransition(
            t,
            beforeSnapshot,
            afterSnapshot
          );

          transitioned++;
          const deltaStr =
            deltas.length > 0
              ? deltas.map((d) => `${d.professionalId}:${d.delta}`).join(',')
              : 'none';
          logger.debug(
            `[RecurringCron] Auto-complete ok id=${id} professionalId=${row.professionalId} remainingBalance=${remainingBalance} financialDeltas=${deltaStr}`
          );
        });
      } catch (err) {
        errorCount++;
        logger.error(`[RecurringCron] Auto-complete error id=${id}:`, err);
      }
    }
  }

  logger.info(
    `[RecurringCron] Auto-complete: transitioned=${transitioned}, skippedRace=${skippedRace}, skippedNotDueUnderLock=${skippedNotDueUnderLock}, skippedInvalidUnderLock=${skippedInvalidUnderLock}, errors=${errorCount}, prefiltered missingTimes=${skippedMissingTimes}, invalidOrder=${skippedInvalidOrder}, notDueYet=${skippedNotDue}`
  );

  return transitioned;
}

cron.schedule('* * * * *', async () => {
  try {
    await completeDueAppointments();

    logger.info('[RecurringCron] Starting recurring appointment generation');

    const result = await generateRecurringAppointments();

    logger.info(
      `[RecurringCron] Finished generation: ${JSON.stringify(result)}`
    );
  } catch (error) {
    logger.error(
      '[RecurringCron] Failed to generate recurring appointments',
      error
    );
  }
});
