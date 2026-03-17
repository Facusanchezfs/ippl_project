const { Appointment, RecurringAppointment, Patient, sequelize } = require('../../models');
const logger = require('../utils/logger');
const { sendSuccess, sendError } = require('../utils/response');
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');

/**
 * Crea una configuración de cita recurrente a partir de una cita base existente.
 *
 * Reglas:
 * - La cita base debe existir y estar activa.
 * - Solo el profesional dueño de la cita o un admin puede crear la recurrencia.
 * - Solo puede existir una recurrencia por cita base.
 * - patientId y professionalId se copian desde la cita base.
 */
const createRecurringAppointment = async (req, res) => {
  const { baseAppointmentId, frequency } = req.body;

  try {
    const result = await sequelize.transaction(async (t) => {
      // 1) Buscar cita base
      const baseAppointment = await Appointment.findOne({
        where: { id: baseAppointmentId, active: true },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!baseAppointment) {
        throw new Error('BASE_APPOINTMENT_NOT_FOUND');
      }

      // 2) Verificar autorización: dueño de la cita o admin
      const isAdmin = req.user?.role === 'admin';
      const isOwner =
        String(baseAppointment.professionalId ?? '') ===
        String(req.user?.id ?? '');

      if (!isAdmin && !isOwner) {
        throw new Error('ACCESS_DENIED');
      }

      // 3) Crear RecurringAppointment copiando datos de la cita base
      // El constraint UNIQUE en baseAppointmentId previene duplicados a nivel de BD
      const created = await RecurringAppointment.create(
        {
          patientId: baseAppointment.patientId,
          professionalId: baseAppointment.professionalId,
          baseAppointmentId,
          frequency,
          active: true,
        },
        { transaction: t }
      );

      return created;
    });

    return sendSuccess(
      res,
      result,
      'Configuración de cita recurrente creada correctamente',
      201
    );
  } catch (error) {
    // Manejo de errores de negocio lanzados dentro de la transacción
    if (error.message === 'BASE_APPOINTMENT_NOT_FOUND') {
      return sendError(res, 404, 'Cita base no encontrada o eliminada');
    }

    if (error.message === 'ACCESS_DENIED') {
      return sendError(res, 403, 'Acceso denegado');
    }

    // Manejo de constraint único a nivel de base de datos
    if (error.name === 'SequelizeUniqueConstraintError') {
      return sendError(
        res,
        409,
        'Ya existe una configuración de recurrencia para esta cita'
      );
    }

    // Error genérico
    logger.error(
      '[createRecurringAppointment] Error al crear recurrencia de cita:',
      error
    );
    return sendError(
      res,
      500,
      'Error al crear configuración de cita recurrente'
    );
  }
};

/**
 * Actualiza una configuración de recurrencia (solo ADMIN).
 * PATCH /api/admin/recurring-appointments/:id
 */
const updateRecurringAppointmentAdmin = async (req, res) => {
  const { id } = req.params;
  const { frequency, nextDate, startTime, duration, sessionCost } = req.body;

  // Validaciones adicionales de negocio
  const todayStr = new Date().toISOString().split('T')[0];
  if (nextDate < todayStr) {
    return sendError(res, 400, 'nextDate no puede estar en el pasado');
  }

  if (duration !== 30 && duration !== 60) {
    return sendError(res, 400, 'duration debe ser 30 o 60');
  }

  if (sessionCost < 0) {
    return sendError(res, 400, 'sessionCost debe ser mayor o igual a 0');
  }

  const toMinutes = (hhmm) => {
    const [h, m] = String(hhmm || '').split(':').map((x) => parseInt(x, 10));
    return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
  };
  const fromMinutes = (mins) => {
    const h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  };

  try {
    const now = new Date();
    const nowTime = now.toTimeString().slice(0, 5);

    const t = await sequelize.transaction();

    // 1) Obtener recurrencia con su cita base
    const recurrence = await RecurringAppointment.findOne({
      where: { id },
      include: [
        {
          model: Appointment,
          as: 'baseAppointment',
        },
      ],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!recurrence || !recurrence.baseAppointment) {
      await t.rollback();
      return sendError(res, 404, 'Configuración de recurrencia no encontrada');
    }

    const baseAppointment = recurrence.baseAppointment;

    // 2) Buscar la siguiente cita programada (future scheduled)
    const nextScheduled = await Appointment.findOne({
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

    if (!nextScheduled) {
      await t.rollback();
      return sendError(
        res,
        404,
        'No hay una cita programada futura para esta recurrencia que pueda editarse'
      );
    }

    // Calcular endTime en base a startTime + duration
    const endMinutes = toMinutes(startTime) + duration;
    const endTime = fromMinutes(endMinutes);

    // Verificar solapamiento de horario para el profesional
    const sameDay = await Appointment.findAll({
      where: {
        id: { [Op.ne]: nextScheduled.id },
        active: true,
        professionalId: nextScheduled.professionalId,
        date: nextDate,
        status: { [Op.eq]: 'scheduled' },
        // Ignorar citas de esta misma recurrencia; se cancelan más adelante
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
      await t.rollback();
      return sendError(res, 409, 'El horario seleccionado no está disponible');
    }

    // Guardar valores antiguos para audit
    const oldDate = baseAppointment.date;
    const oldStart = baseAppointment.startTime;
    const oldEnd = baseAppointment.endTime;
    const oldCost = baseAppointment.sessionCost;
    const oldDurationMinutes = toMinutes(oldEnd) - toMinutes(oldStart);

    // 3) Actualizar la próxima cita programada con la nueva configuración
    await nextScheduled.update(
      {
        date: nextDate,
        startTime,
        endTime,
        sessionCost,
      },
      { transaction: t }
    );

    // 4) Actualizar plantilla base (solo hora y costo, NO fecha)
    await baseAppointment.update(
      {
        startTime,
        endTime,
        sessionCost,
      },
      { transaction: t }
    );

    // 5) Actualizar frecuencia en la recurrencia si cambió
    const oldFrequency = recurrence.frequency;
    if (frequency && frequency !== oldFrequency) {
      recurrence.frequency = frequency;
      await recurrence.save({ transaction: t });
    }

    // 6) Cancelar otras citas futuras programadas de esta recurrencia
    await Appointment.update(
      { status: 'cancelled' },
      {
        where: {
          recurringAppointmentId: recurrence.id,
          active: true,
          status: 'scheduled',
          id: { [Op.ne]: nextScheduled.id },
          date: { [Op.gte]: nextScheduled.date },
        },
        transaction: t,
        // Al cancelar en bloque no necesitamos validar timeOrder ni disparar hooks
        validate: false,
        hooks: false,
      }
    );

    // 7) Commit
    await t.commit();

    // 8) Audit log (fuera de la transacción)
    try {
      const logDir = path.join(__dirname, '../../../logs');
      const logPath = path.join(logDir, 'audit_log.txt');

      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const nowIso = new Date().toISOString();
      const adminId = req.user?.id ?? 'unknown';
      const patientId = recurrence.patientId ?? 'unknown';

      const logEntry =
        `[${nowIso}]\n` +
        `ADMIN_ID=${adminId}\n` +
        `PATIENT_ID=${patientId}\n` +
        `ACTION: recurring_update\n\n` +
        `OLD:\n` +
        `frequency=${oldFrequency}\n` +
        `date=${oldDate}\n` +
        `start=${oldStart}\n` +
        `duration=${oldDurationMinutes}\n` +
        `cost=${oldCost}\n\n` +
        `NEW:\n` +
        `frequency=${frequency}\n` +
        `date=${nextDate}\n` +
        `start=${startTime}\n` +
        `duration=${duration}\n` +
        `cost=${sessionCost}\n\n`;

      fs.appendFile(logPath, logEntry, (err) => {
        if (err) {
          logger.error('[updateRecurringAppointmentAdmin] Error writing audit log:', err);
        }
      });
    } catch (logError) {
      logger.error('[updateRecurringAppointmentAdmin] Audit log failure:', logError);
    }

    return sendSuccess(
      res,
      {
        id: recurrence.id,
        frequency: recurrence.frequency,
        nextDate,
        startTime,
        endTime,
        duration,
        sessionCost,
      },
      'Recurrencia actualizada correctamente'
    );
  } catch (error) {
    logger.error('[updateRecurringAppointmentAdmin] Error al actualizar recurrencia:', error);
    return sendError(res, 500, 'Error al actualizar configuración de recurrencia');
  }
};

/**
 * Devuelve la configuración editable de una recurrencia para un paciente (ADMIN).
 * GET /api/admin/patients/:id/recurring
 */
const getPatientRecurringScheduleAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const nowTime = now.toTimeString().slice(0, 5);

    const toMinutes = (hhmm) => {
      const [h, m] = String(hhmm || '').split(':').map((x) => parseInt(x, 10));
      return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
    };

    // 1) Recurrencia activa del paciente
    const recurrence = await RecurringAppointment.findOne({
      where: { patientId: id, active: true },
      include: [{ model: Appointment, as: 'baseAppointment' }],
      order: [['createdAt', 'DESC']],
    });

    if (!recurrence || !recurrence.baseAppointment) {
      return sendError(res, 404, 'No hay configuración recurrente activa para este paciente');
    }

    const baseAppointment = recurrence.baseAppointment;

    // 2) Próxima(s) cita(s) programadas futuras de la recurrencia
    const nextScheduled = await Appointment.findOne({
      where: {
        recurringAppointmentId: recurrence.id,
        active: true,
        status: 'scheduled',
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
    });

    // Determinar qué cita es realmente la "más próxima" a hoy:
    // - Puede ser la baseAppointment (si está en el futuro y programada)
    // - O la próxima ocurrencia generada por la recurrencia

    const isBaseFutureAndScheduled =
      baseAppointment &&
      baseAppointment.active &&
      baseAppointment.status === 'scheduled' &&
      baseAppointment.date >= todayStr;

    let ref = null;

    if (isBaseFutureAndScheduled && nextScheduled) {
      // Comparar base vs próxima ocurrencia y tomar la más cercana
      const baseKey = `${baseAppointment.date} ${baseAppointment.startTime ?? '00:00'}`;
      const nextKey = `${nextScheduled.date} ${nextScheduled.startTime ?? '00:00'}`;
      ref = baseKey <= nextKey ? baseAppointment : nextScheduled;
    } else if (isBaseFutureAndScheduled) {
      ref = baseAppointment;
    } else if (nextScheduled) {
      ref = nextScheduled;
    } else {
      // Sin citas futuras; como fallback, usar la base si existe
      ref = baseAppointment || null;
    }

    if (!ref) {
      return sendError(res, 404, 'No hay citas de referencia para esta recurrencia');
    }

    const durationMinutesRaw = toMinutes(ref.endTime) - toMinutes(ref.startTime);
    const durationMinutes = durationMinutesRaw === 30 || durationMinutesRaw === 60
      ? durationMinutesRaw
      : 60;

    const sessionCost =
      ref.sessionCost != null ? Number(ref.sessionCost) : baseAppointment.sessionCost ?? 0;

    return sendSuccess(res, {
      recurringId: recurrence.id,
      frequency: recurrence.frequency,
      nextDate: ref.date,
      startTime: ref.startTime,
      duration: durationMinutes,
      sessionCost,
    });
  } catch (error) {
    logger.error('[getPatientRecurringScheduleAdmin] Error:', error);
    return sendError(res, 500, 'Error al obtener configuración recurrente del paciente');
  }
};

/**
 * Crea una configuración de agenda recurrente para un paciente (ADMIN) a partir
 * de los datos de la próxima cita. Si no existe una cita base, se crea una nueva
 * Appointment y luego la RecurringAppointment que la referencia.
 *
 * POST /api/admin/patients/:id/recurring
 */
const createPatientRecurringScheduleAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { frequency, nextDate, startTime, duration, sessionCost } = req.body;

    const todayStr = new Date().toISOString().slice(0, 10);
    if (!frequency || !nextDate || !startTime || !duration) {
      return sendError(res, 400, 'frequency, nextDate, startTime y duration son obligatorios');
    }

    if (nextDate < todayStr) {
      return sendError(res, 400, 'La fecha de la próxima cita no puede estar en el pasado');
    }

    if (duration !== 30 && duration !== 60) {
      return sendError(res, 400, 'duration debe ser 30 o 60');
    }

    if (sessionCost != null && Number(sessionCost) < 0) {
      return sendError(res, 400, 'sessionCost debe ser mayor o igual a 0');
    }

    const toMinutes = (hhmm) => {
      const [h, m] = String(hhmm || '').split(':').map((x) => parseInt(x, 10));
      return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
    };
    const fromMinutes = (mins) => {
      const h = Math.floor(mins / 60) % 24;
      const m = mins % 60;
      return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    };

    const t = await sequelize.transaction();

    try {
      const patient = await Patient.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });

      if (!patient || !patient.active) {
        await t.rollback();
        return sendError(res, 404, 'Paciente no encontrado');
      }

      if (!patient.professionalId) {
        await t.rollback();
        return sendError(
          res,
          400,
          'El paciente debe tener un profesional asignado antes de crear una agenda recurrente'
        );
      }

      const startMinutes = toMinutes(startTime);
      const endTime = fromMinutes(startMinutes + duration);

      // Verificar solapamiento de horario para el profesional
      const sameDayAppointments = await Appointment.findAll({
        where: {
          active: true,
          professionalId: patient.professionalId,
          date: nextDate,
          status: 'scheduled',
        },
        attributes: ['id', 'startTime', 'endTime'],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      const overlaps = sameDayAppointments.some((a) => {
        const s = toMinutes(a.startTime);
        const e = toMinutes(a.endTime);
        return startMinutes < e && s < startMinutes + duration;
      });

      if (overlaps) {
        await t.rollback();
        return sendError(res, 409, 'El horario seleccionado no está disponible');
      }

      const baseAppointment = await Appointment.create(
        {
          patientId: patient.id,
          patientName: patient.name,
          professionalId: patient.professionalId,
          professionalName: patient.professionalName || null,
          date: nextDate,
          startTime,
          endTime,
          type: 'regular',
          status: 'scheduled',
          notes: null,
          audioNote: null,
          sessionCost: sessionCost != null ? Number(sessionCost) : null,
          attended: null,
          paymentAmount: null,
          remainingBalance: sessionCost != null ? Number(sessionCost) : null,
          active: true,
        },
        { transaction: t }
      );

      const recurrence = await RecurringAppointment.create(
        {
          patientId: patient.id,
          professionalId: patient.professionalId,
          baseAppointmentId: baseAppointment.id,
          frequency,
          active: true,
        },
        { transaction: t }
      );

      await t.commit();

      return sendSuccess(
        res,
        {
          recurringId: recurrence.id,
          frequency: recurrence.frequency,
          nextDate,
          startTime,
          duration,
          sessionCost:
            sessionCost != null
              ? Number(sessionCost)
              : Number(baseAppointment.sessionCost) || 0,
        },
        'Agenda recurrente creada correctamente',
        201
      );
    } catch (error) {
      await t.rollback();
      logger.error(
        '[createPatientRecurringScheduleAdmin] Error al crear agenda recurrente:',
        error
      );

      if (error.name === 'SequelizeUniqueConstraintError') {
        return sendError(
          res,
          409,
          'Ya existe una configuración de recurrencia para este paciente'
        );
      }

      return sendError(res, 500, 'Error al crear agenda recurrente para el paciente');
    }
  } catch (error) {
    logger.error('[createPatientRecurringScheduleAdmin] Error inesperado:', error);
    return sendError(res, 500, 'Error al crear agenda recurrente para el paciente');
  }
};

module.exports = {
  createRecurringAppointment,
  updateRecurringAppointmentAdmin,
  getPatientRecurringScheduleAdmin,
  createPatientRecurringScheduleAdmin,
};

