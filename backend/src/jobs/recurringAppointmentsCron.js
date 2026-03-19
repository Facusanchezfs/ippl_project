'use strict';

const cron = require('node-cron');
const { generateRecurringAppointments } = require('../services/recurringGenerationService');
const logger = require('../utils/logger');
const { Appointment } = require('../../models');
const { Op } = require('sequelize');

function toMinutes(hhmm) {
  const [h, m] = String(hhmm || '')
    .split(':')
    .map((x) => parseInt(x, 10));
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

function hasValidTimeOrder(startTime, endTime) {
  // Tolerancia mínima: si faltan tiempos, considerarlos inválidos.
  if (!startTime || !endTime) return false;
  return toMinutes(endTime) > toMinutes(startTime);
}

/**
 * Estrategia activa: completar por hora de inicio (`startTime`).
 *
 * Requerimiento actual:
 * - Una cita debe marcarse como `completed` cuando pasa su hora de inicio.
 * - Ejemplo: 13:30 -> a las 13:31 ya debe estar `completed`.
 *
 * Implementación:
 * - Se ejecuta un UPDATE masivo contra la DB (sin traer datos a memoria).
 * - Condición temporal (en hora local del servidor para ser consistente con `date`/`startTime`):
 *   - `date < todayStr` => siempre completar (citas del día anterior).
 *   - `date = todayStr AND startTime < nowTime` => completar cuando el reloj
 *     supera el minuto de inicio (por eso se usa `<`, no `<=`).
 *
 * Cómo cambiar a la alternativa (`endTime`):
 * - Existe `completeAppointmentsByEndTime()` en este mismo archivo con la misma lógica,
 *   pero reemplazando `startTime` por `endTime` en la condición temporal.
 * - Para activarla, se debería reemplazar el call del cron:
 *     await completeAppointmentsByStartTime();
 *   por:
 *     await completeAppointmentsByEndTime();
 *
 * Ejemplos:
 * - startTime activo:
 *   - 13:30 -> a las 13:31 `completed`
 * - endTime alternativa (no ejecutada):
 *   - endTime=13:50 (ej. duración 20 min) -> a las 13:51 `completed`
 */
async function completeAppointmentsByStartTime() {
  const now = new Date();

  // Fecha/hora locales del servidor para comparar con los campos guardados en hora local.
  const todayStr = now.toLocaleDateString('en-CA'); // YYYY-MM-DD (local)
  const nowTime = now.toTimeString().slice(0, 5); // HH:mm (local)

  const where = {
    active: true,
    [Op.and]: [
      { status: 'scheduled' },
      { status: { [Op.notIn]: ['completed', 'cancelled'] } },
    ],
    [Op.or]: [
      // Días anteriores: siempre completar.
      { date: { [Op.lt]: todayStr } },
      // Mismo día: completar cuando ya pasó el minuto de inicio.
      { date: todayStr, startTime: { [Op.lt]: nowTime } },
    ],
  };

  // 1) Buscar candidatos y validar timeOrder antes del update.
  //    Esto evita que Sequelize rompa con `endTime debe ser mayor que startTime`
  //    si existen filas con startTime/endTime inválidos en la DB.
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
      logger.warn(
        `[RecurringCron] Skipping appointment ${id} (missing startTime/endTime)`
      );
      continue;
    }

    if (!hasValidTimeOrder(startTime, endTime)) {
      skippedInvalidOrder++;
      logger.warn(
        `[RecurringCron] Skipping appointment ${id} (invalid time order: startTime=${startTime}, endTime=${endTime})`
      );
      continue;
    }

    validIds.push(id);
  }

  let affectedRows = 0;
  if (validIds.length > 0) {
    // 2) UPDATE masivo SOLO de los IDs válidos.
    const updateWhere = { id: { [Op.in]: validIds } };

    const result = await Appointment.update(
      { status: 'completed', attended: true },
      {
        where: updateWhere,
        // Necesario para que el hook setee `completedAt` correctamente.
        individualHooks: true,
        // Blindaje: algunos registros pueden tener `startTime/endTime` inválidos
        // y romper `timeOrder`. Ya filtramos en JS, pero igual evitamos que el cron
        // muera si hay casos raros de datos existentes.
        validate: false,
      }
    );
    affectedRows = result?.[0] ?? 0;
  }

  logger.info(
    `[RecurringCron] Auto-completed ${affectedRows} appointments by startTime (date/startTime <= local now). Skipped: missing=${skippedMissingTimes}, invalidOrder=${skippedInvalidOrder}`
  );

  return affectedRows;
}

// Alternativa definida para cambio futuro (NO se ejecuta ahora).
// eslint-disable-next-line no-unused-vars
async function completeAppointmentsByEndTime() {
  const now = new Date();
  const todayStr = now.toLocaleDateString('en-CA'); // YYYY-MM-DD (local)
  const nowTime = now.toTimeString().slice(0, 5); // HH:mm (local)

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
      logger.warn(
        `[RecurringCron] Skipping appointment ${id} (missing startTime/endTime)`
      );
      continue;
    }

    if (!hasValidTimeOrder(startTime, endTime)) {
      skippedInvalidOrder++;
      logger.warn(
        `[RecurringCron] Skipping appointment ${id} (invalid time order: startTime=${startTime}, endTime=${endTime})`
      );
      continue;
    }

    validIds.push(id);
  }

  let affectedRows = 0;
  if (validIds.length > 0) {
    const updateWhere = { id: { [Op.in]: validIds } };

    const result = await Appointment.update(
      { status: 'completed', attended: true },
      {
        where: updateWhere,
        individualHooks: true,
        validate: false,
      }
    );
    affectedRows = result?.[0] ?? 0;
  }

  logger.info(
    `[RecurringCron] Auto-completed ${affectedRows} appointments by endTime (date/endTime <= local now). Skipped: missing=${skippedMissingTimes}, invalidOrder=${skippedInvalidOrder}`
  );

  return affectedRows;
}

// Ejecuta la generación de citas recurrentes todos los minutos (cron)
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
