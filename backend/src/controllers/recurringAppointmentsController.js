const { Appointment, RecurringAppointment, Patient, sequelize } = require('../../models');
const logger = require('../utils/logger');
const { sendSuccess, sendError } = require('../utils/response');
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { computeEndTimeFromStartAndDuration } = require('../utils/timeRangeUtils');
const { getArgentinaCivilDateString, getArgentinaTimeHHMM } = require('../utils/civilDateUtils');

const MSG_INACTIVE_PATIENT_NO_RECURRING =
  'No se puede gestionar la agenda recurrente mientras el paciente está inactivo. Activa al paciente primero.';

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

      // Vincular la cita base con la recurrencia creada.
      // Esto permite que el CRON y las ediciones/cancelaciones por `recurringAppointmentId`
      // funcionen de forma consistente con la recurrencia.
      await baseAppointment.update(
        { recurringAppointmentId: created.id },
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
    if (error.message === 'BASE_APPOINTMENT_NOT_FOUND') {
      return sendError(res, 404, 'Cita base no encontrada o eliminada');
    }

    if (error.message === 'ACCESS_DENIED') {
      return sendError(res, 403, 'Acceso denegado');
    }

    if (error.name === 'SequelizeUniqueConstraintError') {
      return sendError(
        res,
        409,
        'Ya existe una configuración de recurrencia para esta cita'
      );
    }

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

  const todayStr = getArgentinaCivilDateString();
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

  try {
    const nowTime = getArgentinaTimeHHMM();

    const t = await sequelize.transaction();

    const recurrence = await RecurringAppointment.findOne({
      where: { id },
      include: [{ model: Appointment, as: 'baseAppointment' }],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!recurrence || !recurrence.baseAppointment) {
      await t.rollback();
      return sendError(res, 404, 'Configuración de recurrencia no encontrada');
    }

    const baseAppointment = recurrence.baseAppointment;

    const patient = await Patient.findByPk(recurrence.patientId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!patient || !patient.active) {
      await t.rollback();
      return sendError(res, 404, 'Paciente no encontrado');
    }
    if (patient.status === 'inactive') {
      await t.rollback();
      return sendError(res, 400, MSG_INACTIVE_PATIENT_NO_RECURRING);
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

    /** Sin cita futura programada: rearmar desde la cita base (p. ej. tras baja y reactivación del paciente). */
    let usedFallback = false;
    if (!nextScheduled) {
      nextScheduled = baseAppointment;
      if (!nextScheduled) {
        await t.rollback();
        return sendError(
          res,
          404,
          'No hay cita base para rearmar esta recurrencia'
        );
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
      await t.rollback();
      return sendError(
        res,
        400,
        err.message || 'endTime inválido para la duración indicada'
      );
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
      await t.rollback();
      return sendError(res, 409, 'El horario seleccionado no está disponible');
    }

    const oldDate = baseAppointment.date;
    const oldStart = baseAppointment.startTime;
    const oldEnd = baseAppointment.endTime;
    const oldCost = baseAppointment.sessionCost;
    const oldDurationMinutes = toMinutes(oldEnd) - toMinutes(oldStart);

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

    if (!usedFallback) {
      await baseAppointment.update(
        { startTime, endTime, sessionCost },
        { transaction: t }
      );
    }

    const oldFrequency = recurrence.frequency;
    if (frequency && frequency !== oldFrequency) {
      recurrence.frequency = frequency;
      await recurrence.save({ transaction: t });
    }

    if (patient.sessionFrequency !== recurrence.frequency) {
      await patient.update(
        { sessionFrequency: recurrence.frequency },
        { transaction: t }
      );
    }

    // Si `nextDate` es anterior a `oldAnchorDate`, cancelar también desde `nextDate`
    // para evitar que queden citas "próximas" viejas.
    // (Comparación válida para YYYY-MM-DD como strings).
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

    await t.commit();

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
 * Soporta modo 'single' (weekly/biweekly/monthly) y 'group' (twice_weekly).
 * GET /api/admin/patients/:id/recurring
 */
const getPatientRecurringScheduleAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const todayStr = getArgentinaCivilDateString();
    const nowTime = getArgentinaTimeHHMM();

    const toMinutes = (hhmm) => {
      const [h, m] = String(hhmm || '').split(':').map((x) => parseInt(x, 10));
      return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
    };

    // 1) Traer TODAS las recurrencias activas del paciente
    const recurrences = await RecurringAppointment.findAll({
      where: { patientId: id, active: true },
      include: [{ model: Appointment, as: 'baseAppointment' }],
      order: [['createdAt', 'DESC']],
    });

    if (!recurrences.length) {
      return sendError(res, 404, 'No hay configuración recurrente activa para este paciente');
    }

    const simpleRecurrences = recurrences.filter((r) => !r.groupId);
    const groupedById = recurrences
      .filter((r) => r.groupId)
      .reduce((map, r) => {
        const key = String(r.groupId);
        if (!map[key]) map[key] = [];
        map[key].push(r);
        return map;
      }, {});

    // Primer grupo válido de twice_weekly (exactamente 2 registros con mismo groupId)
    const groupList = Object.values(groupedById).find(
      (list) => list.length === 2 && list[0].frequency === 'twice_weekly'
    );

    // Helper: calcula la cita de referencia para una recurrencia dada
    const computeRefFor = async (recurrence) => {
      const baseAppointment = recurrence.baseAppointment;
      if (!baseAppointment) return null;

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

      const isBaseFutureAndScheduled =
        baseAppointment &&
        baseAppointment.active &&
        baseAppointment.status === 'scheduled' &&
        baseAppointment.date >= todayStr;

      let ref = null;

      if (isBaseFutureAndScheduled && nextScheduled) {
        const baseKey = `${baseAppointment.date} ${baseAppointment.startTime ?? '00:00'}`;
        const nextKey = `${nextScheduled.date} ${nextScheduled.startTime ?? '00:00'}`;
        ref = baseKey <= nextKey ? baseAppointment : nextScheduled;
      } else if (isBaseFutureAndScheduled) {
        ref = baseAppointment;
      } else if (nextScheduled) {
        ref = nextScheduled;
      } else {
        ref = baseAppointment || null;
      }

      if (!ref) return null;

      const durationMinutesRaw = toMinutes(ref.endTime) - toMinutes(ref.startTime);
      const durationMinutes =
        durationMinutesRaw === 30 || durationMinutesRaw === 60 ? durationMinutesRaw : 60;

      const sessionCost =
        ref.sessionCost != null ? Number(ref.sessionCost) : baseAppointment.sessionCost ?? 0;

      return {
        recurringId: recurrence.id,
        nextDate: ref.date,
        startTime: ref.startTime,
        duration: durationMinutes,
        sessionCost,
      };
    };

    // 2) Si hay grupo twice_weekly válido → modo grupo
    if (groupList) {
      const [r1, r2] = groupList;
      const [entry1, entry2] = await Promise.all([
        computeRefFor(r1),
        computeRefFor(r2),
      ]);

      if (!entry1 || !entry2) {
        return sendError(res, 404, 'No hay citas de referencia para esta recurrencia');
      }

      return sendSuccess(res, {
        mode: 'group',
        groupId: r1.groupId,
        frequency: 'twice_weekly',
        entries: [entry1, entry2],
      });
    }

    // 3) Fallback: recurrencia simple (comportamiento anterior)
    const recurrence = simpleRecurrences[0];
    if (!recurrence || !recurrence.baseAppointment) {
      return sendError(res, 404, 'No hay configuración recurrente activa para este paciente');
    }

    const singleEntry = await computeRefFor(recurrence);
    if (!singleEntry) {
      return sendError(res, 404, 'No hay citas de referencia para esta recurrencia');
    }

    return sendSuccess(res, {
      mode: 'single',
      recurringId: singleEntry.recurringId,
      frequency: recurrence.frequency,
      nextDate: singleEntry.nextDate,
      startTime: singleEntry.startTime,
      duration: singleEntry.duration,
      sessionCost: singleEntry.sessionCost,
    });
  } catch (error) {
    logger.error('[getPatientRecurringScheduleAdmin] Error:', error);
    return sendError(res, 500, 'Error al obtener configuración recurrente del paciente');
  }
};

/**
 * Crea una configuración de agenda recurrente para un paciente (ADMIN).
 * Soporta frecuencias simples (weekly/biweekly/monthly) y twice_weekly (dos bloques).
 * POST /api/admin/patients/:id/recurring
 */
const createPatientRecurringScheduleAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { frequency } = req.body;

    const todayStr = getArgentinaCivilDateString();

    if (!frequency) {
      return sendError(res, 400, 'frequency es obligatorio');
    }

    const toMinutes = (hhmm) => {
      const [h, m] = String(hhmm || '').split(':').map((x) => parseInt(x, 10));
      return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
    };

    // ── Caso especial: twice_weekly (dos bloques) ──────────────────────────────
    if (frequency === 'twice_weekly') {
      const { entries } = req.body;

      if (!Array.isArray(entries) || entries.length !== 2) {
        return sendError(
          res,
          400,
          'Para frequency="twice_weekly" se requieren exactamente 2 entries'
        );
      }

      for (const entry of entries) {
        const { nextDate, startTime, duration, sessionCost } = entry;

        if (!nextDate || !startTime || !duration) {
          return sendError(
            res,
            400,
            'nextDate, startTime y duration son obligatorios en cada entry'
          );
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
      }

      const t = await sequelize.transaction();

      try {
        const patient = await Patient.findByPk(id, {
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        if (!patient || !patient.active) {
          await t.rollback();
          return sendError(res, 404, 'Paciente no encontrado');
        }

        if (patient.status === 'inactive') {
          await t.rollback();
          return sendError(res, 400, MSG_INACTIVE_PATIENT_NO_RECURRING);
        }

        if (!patient.professionalId) {
          await t.rollback();
          return sendError(
            res,
            400,
            'El paciente debe tener un profesional asignado antes de crear una agenda recurrente'
          );
        }

        const groupId = uuidv4();
        const createdEntries = [];

        for (const entry of entries) {
          const { nextDate, startTime, duration, sessionCost } = entry;

          const startMinutes = toMinutes(startTime);
          let endTime;
          try {
            ({ endTime } = computeEndTimeFromStartAndDuration(startTime, duration));
          } catch (err) {
            await t.rollback();
            return sendError(
              res,
              400,
              err.message || 'endTime inválido para la duración indicada'
            );
          }

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
              groupId,
              patientId: patient.id,
              professionalId: patient.professionalId,
              baseAppointmentId: baseAppointment.id,
              frequency: 'twice_weekly',
              active: true,
            },
            { transaction: t }
          );

          await baseAppointment.update(
            { recurringAppointmentId: recurrence.id },
            { transaction: t }
          );

          createdEntries.push({
            recurringId: recurrence.id,
            nextDate,
            startTime,
            duration,
            sessionCost:
              sessionCost != null
                ? Number(sessionCost)
                : Number(baseAppointment.sessionCost) || 0,
          });
        }

        // Reflejar en Patients la frecuencia vigente de la agenda.
        if (patient.sessionFrequency !== 'twice_weekly') {
          await patient.update(
            { sessionFrequency: 'twice_weekly' },
            { transaction: t }
          );
        }

        await t.commit();

        return sendSuccess(
          res,
          {
            mode: 'group',
            groupId,
            frequency: 'twice_weekly',
            entries: createdEntries,
          },
          'Agenda recurrente (2 veces por semana) creada correctamente',
          201
        );
      } catch (error) {
        await t.rollback();
        logger.error(
          '[createPatientRecurringScheduleAdmin] Error al crear agenda recurrente twice_weekly:',
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
    }

    // ── Caso general: weekly / biweekly / monthly ──────────────────────────────
    const { nextDate, startTime, duration, sessionCost } = req.body;

    if (!nextDate || !startTime || !duration) {
      return sendError(
        res,
        400,
        'frequency, nextDate, startTime y duration son obligatorios'
      );
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

    const t = await sequelize.transaction();

    try {
      const patient = await Patient.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });

      if (!patient || !patient.active) {
        await t.rollback();
        return sendError(res, 404, 'Paciente no encontrado');
      }

      if (patient.status === 'inactive') {
        await t.rollback();
        return sendError(res, 400, MSG_INACTIVE_PATIENT_NO_RECURRING);
      }

      if (!patient.professionalId) {
        await t.rollback();
        return sendError(
          res,
          400,
          'El paciente debe tener un profesional asignado antes de crear una agenda recurrente'
        );
      }

      const toMinutesLocal = (hhmm) => {
        const [h, m] = String(hhmm || '').split(':').map((x) => parseInt(x, 10));
        return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
      };

      let startMinutes;
      let endTime;
      try {
        const range = computeEndTimeFromStartAndDuration(startTime, duration);
        startMinutes = range.startMinutes;
        endTime = range.endTime;
      } catch (err) {
        await t.rollback();
        return sendError(
          res,
          400,
          err.message || 'endTime inválido para la duración indicada'
        );
      }

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
        const s = toMinutesLocal(a.startTime);
        const e = toMinutesLocal(a.endTime);
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

      // IMPORTANT: vincular la Appointment base con la RecurringAppointment
      // para que el CRON pueda contar las "future scheduled" correctamente.
      await baseAppointment.update(
        { recurringAppointmentId: recurrence.id },
        { transaction: t }
      );

      // Reflejar en Patients la frecuencia vigente de la agenda.
      if (patient.sessionFrequency !== frequency) {
        await patient.update(
          { sessionFrequency: frequency },
          { transaction: t }
        );
      }

      await t.commit();

      return sendSuccess(
        res,
        {
          mode: 'single',
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

/**
 * Actualiza en bloque una configuración de recurrencia agrupada (twice_weekly) (solo ADMIN).
 * PATCH /api/admin/recurring-appointments/group/:groupId
 */
const updateRecurringAppointmentGroupAdmin = async (req, res) => {
  const { groupId } = req.params;
  const { entries, active } = req.body;

  const todayStr = getArgentinaCivilDateString();
  const nowTime = getArgentinaTimeHHMM();

  const toMinutes = (hhmm) => {
    const [h, m] = String(hhmm || '').split(':').map((x) => parseInt(x, 10));
    return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
  };

  if (!groupId) {
    return sendError(res, 400, 'groupId es obligatorio');
  }

  // Atajo: solo desactivar el grupo sin cambios de horarios
  if (active === false && !entries) {
    try {
      await RecurringAppointment.update(
        { active: false },
        { where: { groupId, active: true } }
      );
      return sendSuccess(res, { groupId }, 'Recurrencias del grupo desactivadas correctamente');
    } catch (error) {
      logger.error('[updateRecurringAppointmentGroupAdmin] Error al desactivar grupo:', error);
      return sendError(res, 500, 'Error al desactivar las recurrencias del grupo');
    }
  }

  if (!Array.isArray(entries) || entries.length !== 2) {
    return sendError(res, 400, 'entries debe ser un arreglo con exactamente 2 elementos');
  }

  const t = await sequelize.transaction();

  try {
    const recurrences = await RecurringAppointment.findAll({
      where: { groupId, active: true },
      include: [{ model: Appointment, as: 'baseAppointment' }],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!recurrences.length) {
      await t.rollback();
      return sendError(res, 404, 'No se encontraron recurrencias activas para este grupo');
    }

    if (recurrences.length !== 2 || recurrences.some((r) => r.frequency !== 'twice_weekly')) {
      await t.rollback();
      return sendError(res, 400, 'El grupo no es una configuración válida de "2 veces por semana"');
    }

    const recurrenceById = new Map(recurrences.map((r) => [String(r.id), r]));

    const groupPatient = await Patient.findByPk(recurrences[0].patientId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!groupPatient || !groupPatient.active) {
      await t.rollback();
      return sendError(res, 404, 'Paciente no encontrado');
    }
    if (groupPatient.status === 'inactive') {
      await t.rollback();
      return sendError(res, 400, MSG_INACTIVE_PATIENT_NO_RECURRING);
    }

    for (const entry of entries) {
      const { recurringId, nextDate, startTime, duration, sessionCost } = entry;

      if (!recurringId) {
        await t.rollback();
        return sendError(res, 400, 'Cada entry debe incluir recurringId');
      }

      if (!nextDate || !startTime || !duration) {
        await t.rollback();
        return sendError(res, 400, 'nextDate, startTime y duration son obligatorios en cada entry');
      }

      if (nextDate < todayStr) {
        await t.rollback();
        return sendError(res, 400, 'La fecha de la próxima cita no puede estar en el pasado');
      }

      if (duration !== 30 && duration !== 60) {
        await t.rollback();
        return sendError(res, 400, 'duration debe ser 30 o 60');
      }

      if (sessionCost != null && Number(sessionCost) < 0) {
        await t.rollback();
        return sendError(res, 400, 'sessionCost debe ser mayor o igual a 0');
      }

      const recurrence = recurrenceById.get(String(recurringId));
      if (!recurrence || !recurrence.baseAppointment) {
        await t.rollback();
        return sendError(
          res,
          404,
          `Configuración de recurrencia no encontrada para recurringId=${recurringId}`
        );
      }

      const baseAppointment = recurrence.baseAppointment;

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
          await t.rollback();
          return sendError(
            res,
            404,
            'No hay cita base para rearmar esta recurrencia'
          );
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
        await t.rollback();
        return sendError(
          res,
          400,
          err.message || 'endTime inválido para la duración indicada'
        );
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
        await t.rollback();
        return sendError(res, 409, 'El horario seleccionado no está disponible');
      }

      const anchorUpdate = usedFallback
        ? {
            date: nextDate,
            startTime,
            endTime,
            sessionCost,
            status: 'scheduled',
            active: true,
            recurringAppointmentId: recurrence.id,
            patientName: groupPatient.name,
          }
        : { date: nextDate, startTime, endTime, sessionCost };

      await nextScheduled.update(anchorUpdate, { transaction: t });

      if (!usedFallback) {
        await baseAppointment.update(
          { startTime, endTime, sessionCost },
          { transaction: t }
        );
      }

    // Si `nextDate` es anterior a `oldAnchorDate`, cancelar también desde `nextDate`
    // para evitar que queden citas "próximas" viejas.
    // (Comparación válida para YYYY-MM-DD como strings).
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
    }

    if (groupPatient.sessionFrequency !== 'twice_weekly') {
      await groupPatient.update(
        { sessionFrequency: 'twice_weekly' },
        { transaction: t }
      );
    }

    await t.commit();

    return sendSuccess(res, { groupId }, 'Recurrencias del grupo actualizadas correctamente');
  } catch (error) {
    await t.rollback();
    logger.error(
      '[updateRecurringAppointmentGroupAdmin] Error al actualizar recurrencias del grupo:',
      error
    );
    return sendError(res, 500, 'Error al actualizar configuración de recurrencia del grupo');
  }
};

module.exports = {
  createRecurringAppointment,
  updateRecurringAppointmentAdmin,
  getPatientRecurringScheduleAdmin,
  createPatientRecurringScheduleAdmin,
  updateRecurringAppointmentGroupAdmin,
};