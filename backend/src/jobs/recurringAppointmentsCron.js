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
const { getArgentinaCivilDateString, getArgentinaTimeHHMM } = require('../utils/civilDateUtils');

/** Citas procesadas por iteración (transacción atómica por cita, lote para throttling). */
const COMPLETE_BATCH_SIZE = 75;

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

/**
 * remainingBalance al auto-completar:
 * - Misma regla que `updateAppointment` con attended === true:
 *   max(sessionCost - paymentAmount, 0), con nulos como 0.
 * - Pagos parciales previos (paymentAmount en la fila) reducen el saldo pendiente.
 * - attended siempre true en CRON; no-show / null balance no aplica aquí.
 *
 * Estrategia activa: completar por hora de inicio (`startTime`).
 *
 * Transición atómica: `findOne ... FOR UPDATE` + `save` solo si sigue `scheduled`,
 * evita doble aplicación de saldo profesional ante carreras con el API o re-ejecución del CRON.
 */
async function completeAppointmentsByStartTime() {
  const now = new Date();

  const todayStr = getArgentinaCivilDateString(now);
  const nowTime = getArgentinaTimeHHMM(now);

  const where = {
    active: true,
    [Op.and]: [
      { status: 'scheduled' },
      { status: { [Op.notIn]: ['completed', 'cancelled'] } },
    ],
    [Op.or]: [
      { date: { [Op.lt]: todayStr } },
      { date: todayStr, startTime: { [Op.lt]: nowTime } },
    ],
  };

  const candidates = await Appointment.findAll({
    where,
    attributes: ['id', 'startTime', 'endTime'],
  });

  const validIds = [];
  let skippedMissingTimes = 0;
  let skippedInvalidOrder = 0;

  for (const appt of candidates) {
    const { id, startTime, endTime } = appt;

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

    validIds.push(id);
  }

  let transitioned = 0;
  let skippedRace = 0;
  let skippedInvalidUnderLock = 0;
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
        logger.error(
          `[RecurringCron] Auto-complete error id=${id}:`,
          err
        );
      }
    }
  }

  logger.info(
    `[RecurringCron] Auto-complete summary byStartTime: transitioned=${transitioned}, skippedRace=${skippedRace}, skippedInvalidUnderLock=${skippedInvalidUnderLock}, errors=${errorCount}, prefiltered missingTimes=${skippedMissingTimes}, invalidOrder=${skippedInvalidOrder}`
  );

  return transitioned;
}

// Alternativa definida para cambio futuro (NO se ejecuta ahora).
// eslint-disable-next-line no-unused-vars
async function completeAppointmentsByEndTime() {
  const now = new Date();
  const todayStr = getArgentinaCivilDateString(now);
  const nowTime = getArgentinaTimeHHMM(now);

  const where = {
    active: true,
    [Op.and]: [
      { status: 'scheduled' },
      { status: { [Op.notIn]: ['completed', 'cancelled'] } },
    ],
    [Op.or]: [
      { date: { [Op.lt]: todayStr } },
      { date: todayStr, endTime: { [Op.lt]: nowTime } },
    ],
  };

  const candidates = await Appointment.findAll({
    where,
    attributes: ['id', 'startTime', 'endTime'],
  });

  const validIds = [];
  let skippedMissingTimes = 0;
  let skippedInvalidOrder = 0;

  for (const appt of candidates) {
    const { id, startTime, endTime } = appt;

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

    validIds.push(id);
  }

  let transitioned = 0;
  let skippedRace = 0;
  let skippedInvalidUnderLock = 0;
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
        logger.error(
          `[RecurringCron] Auto-complete error id=${id}:`,
          err
        );
      }
    }
  }

  logger.info(
    `[RecurringCron] Auto-complete summary byEndTime: transitioned=${transitioned}, skippedRace=${skippedRace}, skippedInvalidUnderLock=${skippedInvalidUnderLock}, errors=${errorCount}, prefiltered missingTimes=${skippedMissingTimes}, invalidOrder=${skippedInvalidOrder}`
  );

  return transitioned;
}

cron.schedule('* * * * *', async () => {
  try {
    await completeAppointmentsByStartTime();

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
