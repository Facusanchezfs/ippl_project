const { Op } = require('sequelize');
const { Appointment, RecurringAppointment, Patient, User, sequelize } = require('../../models');
const { toAppointmentDTO, toAppointmentDTOList } = require('../../mappers/AppointmentMapper');
const logger = require('../utils/logger');
const { sendSuccess, sendError } = require('../utils/response');
const {
  buildBalanceSnapshot,
  applyProfessionalBalanceForTransition,
} = require('../services/appointmentFinancialEffectsService');

function toMinutes(hhmm) {
  const [h, m] = String(hhmm || '').split(':').map((x) => parseInt(x, 10));
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

function toAmount(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const getAllAppointments = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    
    if (page < 1) return sendError(res, 400, 'page debe ser mayor a 0');
    if (limit < 1 || limit > 100) return sendError(res, 400, 'limit debe estar entre 1 y 100');
    
    const offset = (page - 1) * limit;
    
    const { count, rows: appts } = await Appointment.findAndCountAll({
      where: { active: true },
      attributes: [
        'id', 'patientId', 'professionalId', 'patientName', 'professionalName',
        'date', 'startTime', 'endTime', 'type', 'status',
        'notes', 'audioNote', 'sessionCost', 'attended',
        'paymentAmount', 'noShowPaymentAmount', 'remainingBalance', 'createdAt', 'updatedAt'
      ],
      order: [
        ['date', 'DESC'],
        ['startTime', 'ASC'],
        ['createdAt', 'DESC'],
      ],
      limit,
      offset,
    });

    const totalPages = Math.ceil(count / limit);
    
    const hasPagination = req.query.page !== undefined || req.query.limit !== undefined;
    
    if (hasPagination) {
      return sendSuccess(res, {
        appointments: toAppointmentDTOList(appts),
        pagination: {
          page,
          limit,
          total: count,
          totalPages,
        },
      });
    } else {
      return sendSuccess(res, { appointments: toAppointmentDTOList(appts) });
    }
  } catch (error) {
    logger.error('Error al obtener citas:', error);
    return sendError(res, 500, 'Error al obtener citas');
  }
};

const getProfessionalAppointments = async (req, res) => {
  try {
    const { professionalId } = req.params;

    // Pagination
    const hasPage = req.query.page !== undefined;
    const hasLimit = req.query.limit !== undefined;
    const page = hasPage ? parseInt(req.query.page, 10) : 1;
    const limit = hasLimit ? parseInt(req.query.limit, 10) : null;

    // Filter: all | upcoming | past
    const filter = req.query.filter || 'all';
    const cancelFilter = req.query.cancelFilter || 'include';

    if (hasPage && page < 1) return sendError(res, 400, 'page debe ser mayor a 0');
    if (hasLimit && (limit < 1 || limit > 100))
      return sendError(res, 400, 'limit debe estar entre 1 y 100');

    const offset = limit != null ? (page - 1) * limit : null;

    // Base WHERE
    const whereClause = {
      active: true,
      professionalId,
      [Op.and]: [],
    };

    // Fecha actual / hora actual (manteniendo convención actual del controller).
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD (UTC)
    const nowTime = new Date().toTimeString().slice(0, 5); // HH:mm (local)

    // Aplicar filtros por fecha/hora como lo hace el frontend,
    // para que la paginación sea consistente.
    if (filter === 'upcoming') {
      whereClause[Op.and].push({ status: 'scheduled' });
      whereClause[Op.and].push({
        [Op.or]: [
          { date: { [Op.gt]: today } },
          {
            date: today,
            startTime: { [Op.gte]: nowTime },
          },
        ],
      });
    }

    if (filter === 'past') {
      whereClause[Op.and].push({
        [Op.or]: [
          { date: { [Op.lt]: today } },
          {
            date: today,
            startTime: { [Op.lt]: nowTime },
          },
          // Past incluye todo lo que no es 'scheduled' (cancelled/completed).
          { status: { [Op.ne]: 'scheduled' } },
        ],
      });
    }

    // Aplicar filtro de canceladas para que count/pagination coincidan.
    if (cancelFilter === 'exclude') {
      whereClause[Op.and].push({ status: { [Op.ne]: 'cancelled' } });
    } else if (cancelFilter === 'only') {
      whereClause[Op.and].push({ status: 'cancelled' });
    }

    // Query final
    const queryOptions = {
      where: whereClause,
      include: [
        {
          model: RecurringAppointment,
          as: 'recurringSource',
          attributes: ['frequency'],
          required: false,
        },
      ],
      order: [
        ['date', 'DESC'],
        ['startTime', 'ASC'],
        ['createdAt', 'DESC'],
      ],
      // Con include + join, aseguramos que el count sea por Appointment.id.
      distinct: true,
      ...(limit != null ? { limit, offset } : {}),
    };

    const { count, rows } = await Appointment.findAndCountAll(queryOptions);

    const totalPages = limit != null ? Math.ceil(count / limit) : 1;

    return sendSuccess(res, {
      appointments: toAppointmentDTOList(rows),
      pagination: {
        page,
        limit,
        total: count,
        totalPages,
        hasNext: limit != null ? page < totalPages : false,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    logger.error('Error al obtener citas del profesional:', error);
    return sendError(res, 500, 'Error al obtener citas');
  }
};

const getCompletedProfessionalAppointments = async (req, res) => {
  try {
    const { professionalId } = req.params;

    const appointments = await Appointment.findAll({
      include: [
        {
          model: RecurringAppointment,
          as: 'recurringSource',
          attributes: ['frequency'],
          required: false,
        },
      ],
      where: {
        professionalId,
        status: "completed",
        active: true
      },
      order: [
        ["date", "DESC"],
        ["startTime", "ASC"]
      ]
    });

    return sendSuccess(res, {
      appointments: toAppointmentDTOList(appointments)
    });

  } catch (error) {
    logger.error("Error al obtener citas completadas:", error);
    return sendError(res, 500, "Error al obtener citas completadas");
  }
};

const getScheduledAppointments = async (req, res) => {
  const { professionalId } = req.params;

  try {
    const appointments = await Appointment.findAll({ // o .find() si Mongo
      where: {
        professionalId,
        status: "scheduled", // solo las que están programadas
      },
      order: [["date", "ASC"], ["startTime", "ASC"]], // opcional, por orden cronológico
    });

    return res.json({ success: true, data: { appointments } });
  } catch (error) {
    console.error("Error fetching scheduled appointments:", error);
    return res.status(500).json({ success: false, message: "No se pudieron obtener las citas programadas" });
  }
};


const getTodayProfessionalAppointments = async (req, res) => {
  try {
    const { professionalId } = req.params;

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const today = `${yyyy}-${mm}-${dd}`;

    const appts = await Appointment.findAll({
      where: {
        active: true,
        professionalId,
        date: today,
      },
      order: [
        ['date', 'ASC'],
        ['startTime', 'ASC'],
        ['createdAt', 'DESC'],
      ],
    });

    return sendSuccess(res, { appointments: toAppointmentDTOList(appts) });
  } catch (error) {
    logger.error('Error al obtener citas del profesional (hoy):', error);
    return sendError(res, 500, 'Error al obtener citas');
  }
}

const getPatientAppointments = async (req, res) => {
  try {
    const { patientId } = req.params;

    const appts = await Appointment.findAll({
      where: { active: true, patientId },
      order: [
        ['date', 'DESC'],
        ['startTime', 'ASC'],
        ['createdAt', 'DESC'],
      ],
    });

    return sendSuccess(res, { appointments: toAppointmentDTOList(appts) });
  } catch (error) {
    logger.error('Error al obtener citas del paciente:', error);
    return sendError(res, 500, 'Error al obtener citas');
  }
};

const createAppointment = async (req, res) => {
  try {
    const {
      patientId,
      professionalId,
      date,
      startTime,
      endTime,
      type = 'regular',
      notes,
      audioNote,
      sessionCost,
    } = req.body;

    if (!patientId || !professionalId || !date || !startTime || !endTime) {
      return sendError(res, 400, 'Faltan campos requeridos (patientId, professionalId, date, startTime, endTime)');
    }
    if (toMinutes(endTime) <= toMinutes(startTime)) {
      return sendError(res, 400, 'endTime debe ser mayor que startTime');
    }

    const [patient, professional] = await Promise.all([
      Patient.findByPk(patientId, { attributes: ['id', 'name', 'active'] }),
      User.findByPk(professionalId, { attributes: ['id', 'name'] }),
    ]);

    if (!patient || !patient.active) {
      return sendError(res, 404, 'Paciente no encontrado o eliminado');
    }

    const sameDay = await Appointment.findAll({
      where: {
        active: true,
        professionalId,
        date,
        status: { [Op.eq]: 'scheduled' },
      },
      attributes: ['id', 'startTime', 'endTime'],
    });
    const newStart = toMinutes(startTime);
    const newEnd = toMinutes(endTime);
    const overlaps = sameDay.some((a) => {
      const s = toMinutes(a.startTime);
      const e = toMinutes(a.endTime);
      return newStart < e && s < newEnd;
    });
    if (overlaps) {
      return sendError(res, 400, 'El horario seleccionado no está disponible');
    }

    const safeAudio =
      audioNote && typeof audioNote === 'string' && audioNote.startsWith('/uploads/')
        ? audioNote
        : null;

    const sessionCostNum = toAmount(sessionCost);
    const paymentAmountNum = 0;
    const remainingBalanceNum =
      sessionCostNum !== null ? Math.max(sessionCostNum - paymentAmountNum, 0) : null;

    const created = await Appointment.create({
      patientId,
      patientName: patient?.name || 'Paciente no encontrado',
      professionalId,
      professionalName: professional?.name || 'Profesional no encontrado',
      date,
      startTime,
      endTime,
      type,
      status: 'scheduled',
      notes: notes ?? null,
      audioNote: safeAudio,
      sessionCost: sessionCostNum,
      attended: null,
      paymentAmount: null,
      remainingBalance: remainingBalanceNum,
    });

    return sendSuccess(res, toAppointmentDTO(created), 'Cita creada correctamente', 201);
  } catch (error) {
    logger.error('[createAppointment] Error al crear cita:', error);
    return sendError(res, 500, 'Error al crear cita');
  }
};


const updateAppointment = async (req, res) => {
  try {
    const appt = req.appointment;
    const body = req.body;

    // Regla de negocio: la finalización automática se controla desde cron,
    // por lo que no se permite setear `status='completed'` desde updates manuales.
    if (body?.status === 'completed') {
      return sendError(res, 403, 'La finalización de citas es automática');
    }

    // Regla de negocio: no permitir edición de citas finalizadas o canceladas.
    if (appt.status === 'completed' || appt.status === 'cancelled') {
      return sendError(
        res,
        403,
        'No se puede editar una cita finalizada o cancelada'
      );
    }

    const updates = {};
    const fields = [
      'date', 'startTime', 'endTime',
      'type', 'status',
      'notes', 'audioNote',
      'sessionCost', 'attended',
      'paymentAmount',
      'noShowPaymentAmount',
      'patientId', 'professionalId',
    ];
    for (const f of fields) if (body[f] !== undefined) updates[f] = body[f];

    // Log temporal para diagnosticar problemas de parseo de montos.
    // Si `sessionCost` viene como NaN o string con coma decimal, la validación Joi
    // fallará antes de llegar acá, pero este log ayuda cuando ya pasa el schema.
    if (updates.sessionCost !== undefined) {
      logger.info(
        '[updateAppointment] sessionCost received:',
        updates.sessionCost,
        'type:',
        typeof updates.sessionCost
      );
    }

    if (updates.attended !== undefined) {
      if (typeof updates.attended === 'string') {
        updates.attended = updates.attended.toLowerCase() === 'true';
      } else {
        updates.attended = !!updates.attended;
      }
    }

    if (updates.audioNote !== undefined) {
      const v = updates.audioNote;
      updates.audioNote =
        v && typeof v === 'string' && v.startsWith('/uploads/') ? v : null;
    }

    const newDate  = updates.date ?? appt.date;
    const newStart = updates.startTime       ?? appt.startTime;
    const newEnd   = updates.endTime         ?? appt.endTime;
    const newProf  = updates.professionalId  ?? appt.professionalId;

    if (newStart && newEnd && toMinutes(newEnd) <= toMinutes(newStart)) {
      return sendError(res, 400, 'endTime debe ser mayor que startTime');
    }

    if (
      updates.date !== undefined ||
      updates.startTime !== undefined ||
      updates.endTime !== undefined ||
      updates.professionalId !== undefined
    ) {
      const sameDay = await Appointment.findAll({
        where: {
          id: { [Op.ne]: appt.id },
          active: true,
          professionalId: newProf,
          date: newDate,
          status: { [Op.eq]: 'scheduled' },
        },
        attributes: ['id', 'startTime', 'endTime'],
      });

      const nS = toMinutes(newStart);
      const nE = toMinutes(newEnd);
      const overlaps = sameDay.some(a => {
        const s = toMinutes(a.startTime);
        const e = toMinutes(a.endTime);
        return nS < e && s < nE;
      });
      if (overlaps) {
        return sendError(res, 400, 'El horario seleccionado no está disponible');
      }
    }

    if (updates.patientId !== undefined) {
      const patient = await Patient.findByPk(updates.patientId, { attributes: ['id', 'name', 'active'] });
      if (!patient || !patient.active) {
        return sendError(res, 404, 'Paciente no encontrado o eliminado');
      }
      updates.patientName = patient.name;
    }
    if (updates.professionalId !== undefined) {
      const prof = await User.findByPk(updates.professionalId, { attributes: ['id', 'name'] });
      updates.professionalName = prof?.name || 'Profesional no encontrado';
    }

    let recalcRB = false;

    if (updates.sessionCost !== undefined) {
      updates.sessionCost = toAmount(updates.sessionCost);
      recalcRB = true;
    }
    if (updates.paymentAmount !== undefined) {
      updates.paymentAmount = toAmount(updates.paymentAmount);
      recalcRB = true;
    }
    const finalAttended =
      updates.attended !== undefined ? updates.attended : appt.attended;

    if (finalAttended === false) {
      updates.paymentAmount = null;
      updates.remainingBalance = null;

      if (body.noShowPaymentAmount !== undefined) {
        const normalized = toAmount(body.noShowPaymentAmount);
        updates.noShowPaymentAmount = normalized;
      } else {
        updates.noShowPaymentAmount = appt.noShowPaymentAmount ?? null;
      }

      recalcRB = false;
    }

    if (finalAttended === true) {
      updates.noShowPaymentAmount = null;
    }

    if (recalcRB) {
      const sc = updates.sessionCost   !== undefined ? (updates.sessionCost   ?? 0) : (toAmount(appt.sessionCost)   ?? 0);
      const pa = updates.paymentAmount !== undefined ? (updates.paymentAmount ?? 0) : (toAmount(appt.paymentAmount) ?? 0);
      updates.remainingBalance = Math.max(sc - pa, 0);
    }

    await sequelize.transaction(async (t) => {
      const beforeSnapshot = buildBalanceSnapshot(appt);
      await appt.update(updates, { transaction: t });
      await appt.reload({ transaction: t });
      const afterSnapshot = buildBalanceSnapshot(appt);
      await applyProfessionalBalanceForTransition(t, beforeSnapshot, afterSnapshot);
    });

    return sendSuccess(res, toAppointmentDTO(appt), 'Cita actualizada correctamente');
  } catch (error) {
    logger.error('[updateAppointment] Error:', error);
    return sendError(res, 500, 'Error al actualizar cita');
  }
};


const deleteAppointment = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const appt = req.appointment;
    
    // Si la cita estaba completada y asistida, revertir saldos del profesional
    if (appt.status === 'completed' && appt.attended === true && appt.sessionCost) {
      const sessionCost = toAmount(appt.sessionCost) ?? 0;
      
      if (sessionCost > 0 && appt.professionalId) {
        const prof = await User.findByPk(appt.professionalId, {
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        
        if (prof) {
          const currentTotal = toAmount(prof.saldoTotal) ?? 0;
          const newTotal = round2(Math.max(0, currentTotal - sessionCost));
          
          let commissionInt = parseInt(prof.commission ?? 0, 10);
          if (isNaN(commissionInt)) commissionInt = 0;
          commissionInt = Math.max(0, Math.min(100, commissionInt));
          const commissionRate = commissionInt / 100;
          
          const newPend = round2(newTotal * commissionRate);
          
          await prof.update(
            { saldoTotal: newTotal, saldoPendiente: newPend },
            { transaction: t }
          );
          
          logger.info(`[deleteAppointment] Revertidos saldos del profesional ${appt.professionalId}: -${sessionCost}`);
        }
      }
    }
    
    // Soft delete
    await appt.update({ active: false }, { transaction: t });
    
    await t.commit();
    logger.info(`[deleteAppointment] Cita ${appt.id} eliminada correctamente`);
    return sendSuccess(res, null, 'Cita eliminada correctamente', 204);
  } catch (error) {
    await t.rollback();
    logger.error('[deleteAppointment] Error:', error);
    return sendError(res, 500, 'Error al eliminar la cita');
  }
};

const getAvailableSlots = async (req, res) => {
  try {
    const { professionalId } = req.params;
    const { date } = req.query;

    if (!professionalId || !date) {
      return sendError(res, 400, 'professionalId y date son requeridos');
    }

    const dayAppointments = await Appointment.findAll({
      where: {
        active: true,
        professionalId,
        date,
        status: { [Op.ne]: 'cancelled' },
      },
      attributes: ['startTime', 'endTime'],
      order: [['startTime', 'ASC']],
    });

    const fmt = (h) => String(h).padStart(2, '0') + ':00';
    const allSlots = Array.from({ length: 9 }, (_, i) => fmt(9 + i));
    const SLOT_MINUTES = 60;

    const availableSlots = allSlots.filter((slot) => {
      const sStart = toMinutes(slot);
      const sEnd = sStart + SLOT_MINUTES;

      const overlaps = dayAppointments.some((a) => {
        const aStart = toMinutes(a.startTime);
        const aEnd = toMinutes(a.endTime);
        return sStart < aEnd && aStart < sEnd;
      });

      return !overlaps;
    });

    return sendSuccess(res, { slots: availableSlots });
  } catch (error) {
    logger.error('Error al obtener slots disponibles:', error);
    return sendError(res, 500, 'Error al obtener slots disponibles');
  }
};

const getUpcomingAppointments = async (req, res) => {
  try {
    const today = new Date();
    const yyyyMMdd = today.toISOString().slice(0, 10);
    
    const appts = await Appointment.findAll({
      where: {
        active: true,
        status: 'scheduled',
        date: { [Op.gte]: yyyyMMdd },
      },
      order: [
        ['date', 'ASC'],
        ['startTime', 'ASC'],
        ['createdAt', 'ASC'],
      ],
    });

    return sendSuccess(res, { appointments: toAppointmentDTOList(appts) });
  } catch (error) {
    logger.error('Error al obtener citas próximas:', error);
    return sendError(res, 500, 'Error al obtener citas próximas');
  }
};

module.exports = {
  getAllAppointments,
  getProfessionalAppointments,
  getTodayProfessionalAppointments,
  getCompletedProfessionalAppointments,
  getScheduledAppointments,
  getPatientAppointments,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  getAvailableSlots,
  getUpcomingAppointments
}; 