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
  normalizeToArgentinaCivilYmd,
} = require('../utils/civilDateUtils');
const { updateCronHealth } = require('../services/cronHealthService');

/** Citas procesadas por iteración (transacción atómica por cita, lote para throttling). */
const COMPLETE_BATCH_SIZE = 75;
const AUTO_COMPLETE_CRON = process.env.AUTO_COMPLETE_CRON || '* * * * *';
const RECURRING_GENERATION_CRON =
  process.env.RECURRING_GENERATION_CRON || '*/15 * * * *';
const MAX_RECURRING_ATTEMPTS =
  Number.parseInt(process.env.RECURRING_MAX_ATTEMPTS || '10', 10) || 10;

let recurringGenerationRunning = false;

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

/**
 * Parsea `HH:MM` de columnas de cita. Devuelve `null` si el formato no es válido (no completar).
 */
function parseStrictHHMMToMinutes(hhmm) {
  if (hhmm == null || hhmm === '') return null;
  const s = String(hhmm).trim();
  const m = s.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function hasValidTimeOrder(startTime, endTime) {
  const startMin = parseStrictHHMMToMinutes(startTime);
  const endMin = parseStrictHHMMToMinutes(endTime);
  if (startMin == null || endMin == null) return false;
  return endMin > startMin;
}

/** Domingo civil AR: no se liquida backlog de días previos (hasta el lunes ≥ 09:00). */
function isSundayArgentina(now) {
  const w = getArgentinaWeekdayLongEs(now).toLowerCase();
  return w === 'domingo';
}

/**
 * Evalúa si la cita puede pasar a `completed` en el instante `now` (calendario y reloj civil AR).
 *
 * - Mismo día (`ymd === todayStr`): solo `endTime` + margen; **nunca** backlog.
 * - Días anteriores (`ymd < todayStr`): backlog (≥ 09:00 AR, no domingo).
 * - `ymd > todayStr`: nunca.
 *
 * @returns {{ due: boolean, branch: 'Mismo Día' | 'Backlog' | null }}
 */
function evaluateDueForAutoComplete(appointmentDateRaw, startTime, endTime, now) {
  const ymd = normalizeToArgentinaCivilYmd(appointmentDateRaw);
  const todayStr = normalizeToArgentinaCivilYmd(now);
  if (!ymd || !todayStr) {
    return { due: false, branch: null };
  }

  const startMin = parseStrictHHMMToMinutes(startTime);
  const endMin = parseStrictHHMMToMinutes(endTime);
  if (startMin == null || endMin == null || !(endMin > startMin)) {
    return { due: false, branch: null };
  }

  let nowMin;
  try {
    nowMin = parseStrictHHMMToMinutes(getArgentinaTimeHHMM(now));
  } catch {
    return { due: false, branch: null };
  }
  if (nowMin == null) {
    return { due: false, branch: null };
  }

  if (ymd > todayStr) {
    return { due: false, branch: null };
  }

  if (ymd === todayStr) {
    const dueMin = endMin + AUTO_COMPLETE_AFTER_END_MIN;
    if (!Number.isFinite(dueMin) || dueMin < 0) {
      return { due: false, branch: null };
    }
    const ok = nowMin >= dueMin;
    return { due: ok, branch: ok ? 'Mismo Día' : null };
  }

  if (ymd < todayStr) {
    if (isSundayArgentina(now)) {
      return { due: false, branch: null };
    }
    const ok = nowMin >= BACKLOG_EARLIEST_MINUTES;
    return { due: ok, branch: ok ? 'Backlog' : null };
  }

  return { due: false, branch: null };
}

function isDueForAutoComplete(appointmentDateRaw, startTime, endTime, now) {
  return evaluateDueForAutoComplete(
    appointmentDateRaw,
    startTime,
    endTime,
    now
  ).due;
}

/**
 * Auto-completar citas `scheduled` según regla de negocio (fin de turno + ventanas de backlog).
 * Cada cita: transacción + `FOR UPDATE` sobre la fila antes de evaluar de nuevo y guardar.
 */
async function completeDueAppointments() {
  const now = new Date();
  const todayStr = normalizeToArgentinaCivilYmd(now);

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

    if (!isDueForAutoComplete(date, startTime, endTime, now)) {
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

          if (!row.startTime || !row.endTime) {
            skippedInvalidUnderLock++;
            logger.debug(
              `[RecurringCron] Auto-complete skip id=${id} reason=missing_times_under_lock startTime=${row.startTime} endTime=${row.endTime}`
            );
            return;
          }

          const decisionAt = new Date();
          const { due, branch } = evaluateDueForAutoComplete(
            row.date,
            row.startTime,
            row.endTime,
            decisionAt
          );

          if (!due || !branch) {
            skippedNotDueUnderLock++;
            logger.debug(
              `[RecurringCron] Auto-complete skip id=${id} reason=not_due_under_lock`
            );
            return;
          }

          if (!hasValidTimeOrder(row.startTime, row.endTime)) {
            skippedInvalidUnderLock++;
            logger.debug(
              `[RecurringCron] Auto-complete skip id=${id} reason=invalid_times_under_lock startTime=${row.startTime} endTime=${row.endTime}`
            );
            return;
          }

          const previousStatus = row.status;
          const ymdNorm = normalizeToArgentinaCivilYmd(row.date);
          const horaCita = `${ymdNorm} ${row.startTime}-${row.endTime}`;
          const horaArgentina = `${getArgentinaCivilDateString(decisionAt)} ${getArgentinaTimeHHMM(decisionAt)}`;

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

          logger.info(
            `[RecurringCron] Auto-complete aplicado id=${id} statusAnterior=${previousStatus} horaCita=${horaCita} horaServidorUtc=${decisionAt.toISOString()} horaArgentina=${horaArgentina} rama=${branch} professionalId=${row.professionalId} remainingBalance=${remainingBalance} financialDeltas=${deltaStr}`
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

cron.schedule(AUTO_COMPLETE_CRON, async () => {
  const startedAt = Date.now();
  try {
    const transitioned = await completeDueAppointments();
    await updateCronHealth('autoComplete', {
      status: 'ok',
      transitioned,
      durationMs: Date.now() - startedAt,
      lastRunAt: new Date().toISOString(),
      schedule: AUTO_COMPLETE_CRON,
    });
  } catch (error) {
    await updateCronHealth('autoComplete', {
      status: 'error',
      durationMs: Date.now() - startedAt,
      lastRunAt: new Date().toISOString(),
      lastError: error?.message || String(error),
      schedule: AUTO_COMPLETE_CRON,
    });
    logger.error('[RecurringCron] Auto-complete failed', error);
  }
});

cron.schedule(RECURRING_GENERATION_CRON, async () => {
  const startedAt = Date.now();
  if (recurringGenerationRunning) {
    logger.warn(
      '[RecurringCron] Skipping recurring generation because previous cycle is still running'
    );
    await updateCronHealth('recurringGeneration', {
      status: 'warn',
      skipped: true,
      reason: 'already_running',
      durationMs: 0,
      lastRunAt: new Date().toISOString(),
      schedule: RECURRING_GENERATION_CRON,
    });
    return;
  }

  recurringGenerationRunning = true;
  try {
    await sequelize.query('SELECT 1');
    logger.info('[RecurringCron] Starting recurring appointment generation');
    const result = await generateRecurringAppointments({
      maxAttemptsPerRecurrence: MAX_RECURRING_ATTEMPTS,
    });

    logger.info(
      `[RecurringCron] Finished generation: ${JSON.stringify(result)}`
    );
    await updateCronHealth('recurringGeneration', {
      status: result.errors > 0 ? 'warn' : 'ok',
      durationMs: Date.now() - startedAt,
      lastRunAt: new Date().toISOString(),
      schedule: RECURRING_GENERATION_CRON,
      maxAttemptsPerRecurrence: MAX_RECURRING_ATTEMPTS,
      ...result,
    });
  } catch (error) {
    await updateCronHealth('recurringGeneration', {
      status: 'error',
      durationMs: Date.now() - startedAt,
      lastRunAt: new Date().toISOString(),
      schedule: RECURRING_GENERATION_CRON,
      maxAttemptsPerRecurrence: MAX_RECURRING_ATTEMPTS,
      lastError: error?.message || String(error),
    });
    logger.error(
      '[RecurringCron] Failed to generate recurring appointments',
      error
    );
  } finally {
    recurringGenerationRunning = false;
  }
});
