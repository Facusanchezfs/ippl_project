'use strict';

const { Op } = require('sequelize');
const { Appointment, RecurringAppointment, Patient } = require('../../models');
const { computeEndTimeFromStartAndDuration } = require('../utils/timeRangeUtils');
const { getArgentinaCivilDateString, getArgentinaTimeHHMM } = require('../utils/civilDateUtils');

const MSG_INACTIVE_PATIENT_NO_RECURRING =
  'No se puede gestionar la agenda recurrente mientras el paciente está inactivo. Activa al paciente primero.';

function baseAppointmentIsFutureScheduledTemplate(baseAppointment, todayStr) {
  return (
    baseAppointment &&
    baseAppointment.active &&
    baseAppointment.status === 'scheduled' &&
    String(baseAppointment.date) >= String(todayStr)
  );
}

class ScheduleApplyError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Misma lógica que `updateRecurringAppointmentAdmin` pero dentro de una transacción ya abierta.
 * No hace commit ni rollback.
 *
 * @param {object} opts
 * @param {import('sequelize').Transaction} opts.transaction
 * @param {string|number} opts.recurrenceId
 * @param {string} opts.frequency
 * @param {string} opts.nextDate YYYY-MM-DD
 * @param {string} opts.startTime HH:mm
 * @param {30|60} opts.duration
 * @param {number} opts.sessionCost
 * @returns {Promise<object>} metadatos para auditoría
 */
async function applyAdminRecurringScheduleUpdate({
  transaction: t,
  recurrenceId,
  frequency,
  nextDate,
  startTime,
  duration,
  sessionCost,
}) {
  const todayStr = getArgentinaCivilDateString();
  if (nextDate < todayStr) {
    throw new ScheduleApplyError(400, 'nextDate no puede estar en el pasado');
  }
  if (duration !== 30 && duration !== 60) {
    throw new ScheduleApplyError(400, 'duration debe ser 30 o 60');
  }
  if (Number(sessionCost) < 0) {
    throw new ScheduleApplyError(400, 'sessionCost debe ser mayor o igual a 0');
  }

  const toMinutes = (hhmm) => {
    const [h, m] = String(hhmm || '').split(':').map((x) => parseInt(x, 10));
    return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
  };

  const nowTime = getArgentinaTimeHHMM();

  const recurrence = await RecurringAppointment.findOne({
    where: { id: recurrenceId },
    include: [{ model: Appointment, as: 'baseAppointment' }],
    transaction: t,
    lock: t.LOCK.UPDATE,
  });

  if (!recurrence || !recurrence.baseAppointment) {
    throw new ScheduleApplyError(404, 'Configuración de recurrencia no encontrada');
  }

  const baseAppointment = recurrence.baseAppointment;

  const patient = await Patient.findByPk(recurrence.patientId, {
    transaction: t,
    lock: t.LOCK.UPDATE,
  });
  if (!patient || !patient.active) {
    throw new ScheduleApplyError(404, 'Paciente no encontrado');
  }
  if (patient.status === 'inactive') {
    throw new ScheduleApplyError(400, MSG_INACTIVE_PATIENT_NO_RECURRING);
  }

  let nextScheduled = await Appointment.findOne({
    where: {
      recurringAppointmentId: recurrence.id,
      status: 'scheduled',
      active: true,
      [Op.or]: [
        { date: { [Op.gt]: todayStr } },
        {
          date: todayStr,
          startTime: { [Op.gte]: nowTime },
        },
      ],
    },
    order: [
      ['date', 'ASC'],
      ['startTime', 'ASC'],
    ],
    transaction: t,
    lock: t.LOCK.UPDATE,
  });

  let usedFallback = false;
  if (!nextScheduled) {
    nextScheduled = baseAppointment;
    if (!nextScheduled) {
      throw new ScheduleApplyError(404, 'No hay cita base para rearmar esta recurrencia');
    }
    usedFallback = true;
    if (!recurrence.active) {
      recurrence.active = true;
      await recurrence.save({ transaction: t });
    }
  }

  const oldAnchorDate = nextScheduled.date;

  let endTime;
  try {
    ({ endTime } = computeEndTimeFromStartAndDuration(startTime, duration));
  } catch (err) {
    throw new ScheduleApplyError(400, err.message || 'endTime inválido para la duración indicada');
  }

  const sameDay = await Appointment.findAll({
    where: {
      id: { [Op.ne]: nextScheduled.id },
      active: true,
      professionalId: nextScheduled.professionalId,
      date: nextDate,
      status: { [Op.eq]: 'scheduled' },
      recurringAppointmentId: { [Op.ne]: recurrence.id },
    },
    attributes: ['id', 'startTime', 'endTime'],
    transaction: t,
    lock: t.LOCK.UPDATE,
  });

  const newStart = toMinutes(startTime);
  const newEnd = toMinutes(endTime);
  const overlaps = sameDay.some((a) => {
    const s = toMinutes(a.startTime);
    const e = toMinutes(a.endTime);
    return newStart < e && s < newEnd;
  });

  if (overlaps) {
    throw new ScheduleApplyError(409, 'El horario seleccionado no está disponible');
  }

  const oldDate = baseAppointment.date;
  const oldStart = baseAppointment.startTime;
  const oldEnd = baseAppointment.endTime;
  const oldCost = baseAppointment.sessionCost;
  const oldDurationMinutes = toMinutes(oldEnd) - toMinutes(oldStart);
  const oldFrequency = recurrence.frequency;

  const anchorUpdate = usedFallback
    ? {
        date: nextDate,
        startTime,
        endTime,
        sessionCost,
        status: 'scheduled',
        active: true,
        recurringAppointmentId: recurrence.id,
        patientName: patient.name,
      }
    : { date: nextDate, startTime, endTime, sessionCost };

  await nextScheduled.update(anchorUpdate, { transaction: t });

  if (!usedFallback && baseAppointmentIsFutureScheduledTemplate(baseAppointment, todayStr)) {
    await baseAppointment.update({ startTime, endTime, sessionCost }, { transaction: t });
  }

  if (frequency && frequency !== oldFrequency) {
    recurrence.frequency = frequency;
    await recurrence.save({ transaction: t });
  }

  if (patient.sessionFrequency !== recurrence.frequency) {
    await patient.update({ sessionFrequency: recurrence.frequency }, { transaction: t });
  }

  const cancelFromDate = usedFallback
    ? nextDate
    : nextDate < oldAnchorDate
      ? nextDate
      : oldAnchorDate;

  await Appointment.update(
    { status: 'cancelled' },
    {
      where: {
        recurringAppointmentId: recurrence.id,
        active: true,
        status: 'scheduled',
        id: { [Op.ne]: nextScheduled.id },
        date: { [Op.gte]: cancelFromDate },
      },
      transaction: t,
      validate: false,
      hooks: false,
    }
  );

  return {
    recurrence,
    patientId: recurrence.patientId,
    endTime,
    oldFrequency,
    oldDate,
    oldStart,
    oldEnd,
    oldCost,
    oldDurationMinutes,
  };
}

module.exports = {
  applyAdminRecurringScheduleUpdate,
  ScheduleApplyError,
  MSG_INACTIVE_PATIENT_NO_RECURRING,
  baseAppointmentIsFutureScheduledTemplate,
};
