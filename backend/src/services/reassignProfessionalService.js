'use strict';

const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { Appointment, RecurringAppointment } = require('../../models');
const logger = require('../utils/logger');
const { getArgentinaCivilDateString } = require('../utils/civilDateUtils');
const { toYmd } = require('./recurringGenerationService');

/** YYYY-MM-DD -> Date local (sin corrimiento por timezone). */
function ymdToLocalDate(ymd) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function localDateToYmd(dt) {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Primera fecha >= fromYmd cuyo día de semana coincide con `targetWeekday`
 * (0=domingo .. 6=sábado). Si `fromYmd` ya cae en ese día, devuelve `fromYmd`.
 * Se usa para preservar la cadencia del segundo bloque en `twice_weekly`.
 */
function nextYmdForWeekday(fromYmd, targetWeekday) {
  const base = ymdToLocalDate(fromYmd);
  const diff = (((targetWeekday - base.getDay()) % 7) + 7) % 7;
  base.setDate(base.getDate() + diff);
  return localDateToYmd(base);
}

/**
 * Reasigna un paciente a un nuevo profesional re-anclando su agenda recurrente.
 *
 * Dentro de la transacción `t` recibida:
 *  1. Captura la configuración de slot (horario/costo/frecuencia) de las recurrencias activas.
 *  2. Cancela (active:false, status:'cancelled') las citas futuras `scheduled` del paciente
 *     con el profesional anterior. Sólo afecta citas no realizadas → sin impacto financiero.
 *  3. Desactiva las recurrencias activas del paciente.
 *  4. Crea nueva cita base + recurrencia bajo el nuevo profesional ancladas en `nextDate`.
 *
 * Las citas pasadas/completadas con el profesional anterior se conservan (trazabilidad).
 *
 * @returns {{ cancelledCount: number, createdRecurrences: number, created: Array }}
 */
async function reassignPatientProfessional({
  t,
  patient,
  oldProfessionalId,
  newProfessionalId,
  newProfessionalName,
  nextDate,
}) {
  if (!t) {
    throw new Error('reassignPatientProfessional requiere una transacción `t`');
  }
  const todayStr = getArgentinaCivilDateString();
  const patientId = patient.id;

  // 1) Capturar recurrencias activas del paciente con su cita base.
  const activeRecurrences = await RecurringAppointment.findAll({
    where: { patientId, active: true },
    include: [{ model: Appointment, as: 'baseAppointment', required: false }],
    transaction: t,
  });

  // Para cada recurrencia, derivar el slot vigente: próxima cita futura scheduled
  // (refleja horario/costo actuales) o, en su defecto, la cita base.
  const slots = [];
  for (const rec of activeRecurrences) {
    const nextFuture = await Appointment.findOne({
      where: {
        recurringAppointmentId: rec.id,
        active: true,
        status: 'scheduled',
        date: { [Op.gte]: todayStr },
      },
      order: [
        ['date', 'ASC'],
        ['startTime', 'ASC'],
      ],
      transaction: t,
    });

    const slotSource = nextFuture || rec.baseAppointment;
    if (!slotSource || !slotSource.startTime || !slotSource.endTime) {
      logger.warn(
        `[ReassignProfessional] Recurrencia ${rec.id} (paciente ${patientId}) sin slot válido; se desactiva sin re-crear.`
      );
      continue;
    }

    slots.push({
      frequency: rec.frequency,
      startTime: slotSource.startTime,
      endTime: slotSource.endTime,
      sessionCost:
        patient.sessionCost != null ? patient.sessionCost : slotSource.sessionCost,
      // Día de semana original (para preservar el segundo bloque en twice_weekly).
      originalWeekday: ymdToLocalDate(toYmd(slotSource.date)).getDay(),
    });
  }

  // 2) Cancelar futuras scheduled del paciente con el profesional anterior.
  const [cancelledCount] = await Appointment.update(
    { status: 'cancelled', active: false },
    {
      where: {
        patientId,
        professionalId: oldProfessionalId,
        active: true,
        status: 'scheduled',
        date: { [Op.gte]: todayStr },
      },
      transaction: t,
      validate: false,
      hooks: false,
    }
  );

  // 3) Desactivar las recurrencias activas del paciente.
  await RecurringAppointment.update(
    { active: false },
    { where: { patientId, active: true }, transaction: t }
  );

  // 4) Re-crear bajo el nuevo profesional, ancladas en `nextDate`.
  if (slots.length === 0) {
    logger.info(
      `[ReassignProfessional] Paciente ${patientId}: sin recurrencias re-creables. Canceladas ${cancelledCount} cita(s) futura(s) del profesional ${oldProfessionalId}.`
    );
    return { cancelledCount, createdRecurrences: 0, created: [] };
  }

  if (!nextDate || nextDate < todayStr) {
    throw new Error(
      `nextDate inválida para reasignación (recibido="${nextDate}", hoy="${todayStr}")`
    );
  }

  // twice_weekly: ambos bloques comparten un mismo groupId nuevo.
  const isGroup = slots.length > 1 || slots.some((s) => s.frequency === 'twice_weekly');
  const newGroupId = isGroup ? uuidv4() : null;

  const created = [];
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    // Slot único: anclar exactamente en nextDate (fecha elegida por el admin).
    // Múltiples slots: el primero en nextDate, el resto en su weekday original >= nextDate.
    const anchorDate =
      slots.length === 1
        ? nextDate
        : i === 0
          ? nextDate
          : nextYmdForWeekday(nextDate, slot.originalWeekday);

    const sessionCost =
      slot.sessionCost != null ? Number(slot.sessionCost) : null;

    const baseAppointment = await Appointment.create(
      {
        patientId,
        patientName: patient.name,
        professionalId: newProfessionalId,
        professionalName: newProfessionalName || null,
        date: anchorDate,
        startTime: slot.startTime,
        endTime: slot.endTime,
        type: 'regular',
        status: 'scheduled',
        notes: null,
        audioNote: null,
        sessionCost,
        attended: null,
        paymentAmount: null,
        remainingBalance: sessionCost,
        active: true,
      },
      { transaction: t }
    );

    const recurrence = await RecurringAppointment.create(
      {
        groupId: newGroupId,
        patientId,
        professionalId: newProfessionalId,
        baseAppointmentId: baseAppointment.id,
        frequency: slot.frequency,
        active: true,
      },
      { transaction: t }
    );

    // Vincular la cita base con la recurrencia (igual que el alta de agenda admin),
    // para que el CRON cuente correctamente las "future scheduled".
    await baseAppointment.update(
      { recurringAppointmentId: recurrence.id },
      { transaction: t }
    );

    created.push({
      recurringId: recurrence.id,
      baseAppointmentId: baseAppointment.id,
      date: anchorDate,
    });
  }

  logger.info(
    `[ReassignProfessional] Paciente ${patientId} reasignado de profesional ${oldProfessionalId} a ${newProfessionalId}: canceladas ${cancelledCount} futura(s); re-creadas ${created.length} recurrencia(s) desde ${nextDate}.`
  );

  return { cancelledCount, createdRecurrences: created.length, created };
}

module.exports = {
  reassignPatientProfessional,
};
