const { Op } = require('sequelize');
const { Appointment, Patient, User, sequelize } = require('../../models');
const { toAppointmentDTO, toAppointmentDTOList } = require('../../mappers/AppointmentMapper');
const logger = require('../utils/logger');

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
    logger.debug('getAllAppointments method');
    const appts = await Appointment.findAll({
      where: { active: true },
      order: [
        ['date', 'DESC'],
        ['startTime', 'ASC'],
        ['createdAt', 'DESC'],
      ],
    });

    return res.json({ appointments: toAppointmentDTOList(appts) });
  } catch (error) {
    logger.error('Error al obtener citas:', error);
    return res.status(500).json({ message: 'Error al obtener citas' });
  }
};

const getProfessionalAppointments = async (req, res) => {
  try {
    const { professionalId } = req.params;

    const appts = await Appointment.findAll({
      where: { active: true, professionalId },
      order: [
        ['date', 'DESC'],
        ['startTime', 'ASC'],
        ['createdAt', 'DESC'],
      ],
    });

    return res.json({ appointments: toAppointmentDTOList(appts) });
  } catch (error) {
    logger.error('Error al obtener citas del profesional:', error);
    return res.status(500).json({ message: 'Error al obtener citas' });
  }
};

const getTodayProfessionalAppointments = async (req, res) => {
  try {
    const { professionalId } = req.params;

    // YYYY-MM-DD en hora local del servidor
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

    return res.json({ appointments: toAppointmentDTOList(appts) });
  } catch (error) {
    logger.error('Error al obtener citas del profesional (hoy):', error);
    return res.status(500).json({ message: 'Error al obtener citas' });
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

    return res.json({ appointments: toAppointmentDTOList(appts) });
  } catch (error) {
    logger.error('Error al obtener citas del paciente:', error);
    return res.status(500).json({ message: 'Error al obtener citas' });
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

    // 1) Validaciones básicas
    if (!patientId || !professionalId || !date || !startTime || !endTime) {
      return res.status(400).json({
        message:
          'Faltan campos requeridos (patientId, professionalId, date, startTime, endTime)',
      });
    }
    if (toMinutes(endTime) <= toMinutes(startTime)) {
      return res.status(400).json({ message: 'endTime debe ser mayor que startTime' });
    }

    // 2) Snapshots de nombres (si no existen, seguimos con texto por defecto)
    const [patient, professional] = await Promise.all([
      Patient.findByPk(patientId, { attributes: ['id', 'name'] }),
      User.findByPk(professionalId, { attributes: ['id', 'name'] }),
    ]);

    // 3) Chequeo de solapamientos: misma fecha/profesional, activo y no cancelado
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
      // Solapa si empieza antes de que termine la otra y termina después de que empieza la otra
      return newStart < e && s < newEnd;
    });
    if (overlaps) {
      return res.status(400).json({ message: 'El horario seleccionado no está disponible' });
    }

    // 4) Saneos / normalizaciones
    const safeAudio =
      audioNote && typeof audioNote === 'string' && audioNote.startsWith('/uploads/')
        ? audioNote
        : null;

    const sessionCostNum = toAmount(sessionCost);
    // Como no hay paymentAmount en el DTO de creación, asumimos 0 al calcular remainingBalance
    const paymentAmountNum = 0;
    const remainingBalanceNum =
      sessionCostNum !== null ? Math.max(sessionCostNum - paymentAmountNum, 0) : null;

    // 5) Crear cita (status fijo 'scheduled'; completedAt lo setean hooks al marcar 'completed')
    const created = await Appointment.create({
      patientId,
      patientName: patient?.name || 'Paciente no encontrado',
      professionalId,
      professionalName: professional?.name || 'Profesional no encontrado',
      date,
      startTime,
      endTime,
      type,                 // 'regular' | 'first_time' | 'emergency'
      status: 'scheduled',  // ← forzado al crear
      notes: notes ?? null,
      audioNote: safeAudio,
      sessionCost: sessionCostNum,
      attended: null,               // no viene en el DTO de creación
      paymentAmount: null,          // no viene en el DTO de creación
      remainingBalance: remainingBalanceNum,
      // active: true por defecto (soft delete en el modelo)
    });

    return res.status(201).json(toAppointmentDTO(created));
  } catch (error) {
    logger.error('[createAppointment] Error al crear cita:', error);
    return res.status(500).json({ message: 'Error al crear cita', error: error.message });
  }
};


// PUT /appointments/:id
const updateAppointment = async (req, res) => {
  try {
    // La cita ya viene validada (existe, active=true, permisos OK)
    const appt = req.appointment;
    const body = req.body;

    // Campos permitidos
    const updates = {};
    const fields = [
      'date', 'startTime', 'endTime',
      'type', 'status',
      'notes', 'audioNote',
      'sessionCost', 'attended',
      'paymentAmount', // remainingBalance lo recalculamos
      'patientId', 'professionalId',
    ];
    for (const f of fields) if (body[f] !== undefined) updates[f] = body[f];

    // Normalizar attended (acepta string "true"/"false")
    if (updates.attended !== undefined) {
      if (typeof updates.attended === 'string') {
        updates.attended = updates.attended.toLowerCase() === 'true';
      } else {
        updates.attended = !!updates.attended;
      }
    }

    // Saneo de audioNote (solo rutas internas)
    if (updates.audioNote !== undefined) {
      const v = updates.audioNote;
      updates.audioNote =
        v && typeof v === 'string' && v.startsWith('/uploads/') ? v : null;
    }

    // Si cambian fecha/hora/profesional → validar (end > start) + solapamientos
    const newDate  = updates.date            ?? appt.date;
    const newStart = updates.startTime       ?? appt.startTime;
    const newEnd   = updates.endTime         ?? appt.endTime;
    const newProf  = updates.professionalId  ?? appt.professionalId;

    if (newStart && newEnd && toMinutes(newEnd) <= toMinutes(newStart)) {
      return res.status(400).json({ message: 'endTime debe ser mayor que startTime' });
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
        return nS < e && s < nE; // solapamiento
      });
      if (overlaps) {
        return res.status(400).json({ message: 'El horario seleccionado no está disponible' });
      }
    }

    // Refrescar snapshots si cambian IDs
    if (updates.patientId !== undefined) {
      const patient = await Patient.findByPk(updates.patientId, { attributes: ['id', 'name'] });
      updates.patientName = patient?.name || 'Paciente no encontrado';
    }
    if (updates.professionalId !== undefined) {
      const prof = await User.findByPk(updates.professionalId, { attributes: ['id', 'name'] });
      updates.professionalName = prof?.name || 'Profesional no encontrado';
    }

    // Normalizar montos y recalcular remainingBalance si corresponde
    let recalcRB = false;

    if (updates.sessionCost !== undefined) {
      updates.sessionCost = toAmount(updates.sessionCost);
      recalcRB = true;
    }
    if (updates.paymentAmount !== undefined) {
      updates.paymentAmount = toAmount(updates.paymentAmount);
      recalcRB = true;
    }

    if (recalcRB) {
      const sc = updates.sessionCost   !== undefined ? (updates.sessionCost   ?? 0) : (toAmount(appt.sessionCost)   ?? 0);
      const pa = updates.paymentAmount !== undefined ? (updates.paymentAmount ?? 0) : (toAmount(appt.paymentAmount) ?? 0);
      updates.remainingBalance = Math.max(sc - pa, 0);
    }

    // ===== Ajuste de saldos por cambio a/desde completed & attended =====
    const prevStatus   = appt.status;
    const prevAttended = appt.attended === true;
    const prevCost     = toAmount(appt.sessionCost) ?? 0;
    const prevProfId   = appt.professionalId;

    const nextStatus   = updates.status          ?? prevStatus;
    const nextAttended = updates.attended !== undefined ? updates.attended : prevAttended;
    const nextCost     = updates.sessionCost !== undefined ? (updates.sessionCost ?? 0) : prevCost;
    const nextProfId   = updates.professionalId ?? prevProfId;

    const includePrev = prevStatus === 'completed' && prevAttended;
    const includeNext = nextStatus === 'completed' && nextAttended;

    await sequelize.transaction(async (t) => {
      // 1) Persistir cita
      await appt.update(updates, { transaction: t });
      await appt.reload({ transaction: t });

      // 2) Helper que usa commission del usuario (entero %) para saldoPendiente
      const applyDelta = async (userId, delta) => {
        if (!userId || !delta) return;

        const prof = await User.findByPk(userId, {
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (!prof) return;

        const currentTotal = toAmount(prof.saldoTotal) ?? 0;
        const newTotal = round2(currentTotal + delta);

        // commission: entero 0..100 (si viene null/undefined, usar 0)
        let commissionInt = parseInt(prof.commission ?? 0, 10);
        if (isNaN(commissionInt)) commissionInt = 0;
        commissionInt = Math.max(0, Math.min(100, commissionInt));
        const commissionRate = commissionInt / 100;

        const newPend = round2(newTotal * commissionRate);

        await prof.update(
          { saldoTotal: newTotal, saldoPendiente: newPend },
          { transaction: t }
        );
      };

      if (prevProfId !== nextProfId) {
        if (includePrev && prevCost) await applyDelta(prevProfId, -prevCost);
        if (includeNext && nextCost) await applyDelta(nextProfId,  +nextCost);
      } else {
        const before = includePrev ? prevCost : 0;
        const after  = includeNext ? nextCost : 0;
        const delta  = round2(after - before);
        if (delta !== 0) await applyDelta(prevProfId, delta);
      }
    });

    return res.json(toAppointmentDTO(appt));
  } catch (error) {
    logger.error('[updateAppointment] Error:', error);
    return res.status(500).json({ message: 'Error al actualizar cita', error: error.message });
  }
};


const deleteAppointment = async (req, res) => {
  try {
    const appt = req.appointment; // ya viene del middleware y está activa
    await appt.update({ active: false });

    return res.json({
      message: 'Cita eliminada correctamente',
      appointment: appt, // devuelve el registro actualizado
    });
  } catch (error) {
    logger.error('[deleteAppointment] Error:', error);
    return res.status(500).json({ message: 'Error al eliminar la cita' });
  }
};

const getAvailableSlots = async (req, res) => {
  try {
    const { professionalId } = req.params;
    const { date } = req.query;

    if (!professionalId || !date) {
      return res.status(400).json({ message: 'professionalId y date son requeridos' });
    }

    // Traer citas activas del profesional para ese día (excepto canceladas)
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

    // Generar slots de 60 min entre 09:00 y 17:00 (inclusive 17:00 como en tu implementación original)
    const allSlots = Array.from({ length: 9 }, (_, i) => fmt(9 + i)); // 09:00 ... 17:00
    const SLOT_MINUTES = 60;

    const availableSlots = allSlots.filter((slot) => {
      const sStart = toMinutes(slot);
      const sEnd = sStart + SLOT_MINUTES;

      // Excluir si solapa con alguna cita existente
      const overlaps = dayAppointments.some((a) => {
        const aStart = toMinutes(a.startTime);
        const aEnd = toMinutes(a.endTime);
        // solapan si el inicio del slot es antes del fin de la cita y
        // el inicio de la cita es antes del fin del slot
        return sStart < aEnd && aStart < sEnd;
      });

      return !overlaps;
    });

    return res.json({ slots: availableSlots });
  } catch (error) {
    logger.error('Error al obtener slots disponibles:', error);
    return res.status(500).json({ message: 'Error al obtener slots disponibles' });
  }
};

const getUpcomingAppointments = async (req, res) => {
  try {
    const today = new Date();
    // YYYY-MM-DD para comparar con DATEONLY
    const yyyyMMdd = today.toISOString().slice(0, 10);
    
    const appts = await Appointment.findAll({
      where: {
        active: true,
        status: 'scheduled',
        // Fecha >= hoy (según la BD)
        date: { [Op.gte]: yyyyMMdd },
      },
      order: [
        ['date', 'ASC'],
        ['startTime', 'ASC'],
        ['createdAt', 'ASC'],
      ],
    });

    return res.json({ appointments: toAppointmentDTOList(appts) });
  } catch (error) {
    logger.error('Error al obtener citas próximas:', error);
    return res.status(500).json({ message: 'Error al obtener citas próximas' });
  }
};

module.exports = {
  getAllAppointments,
  getProfessionalAppointments,
  getTodayProfessionalAppointments,
  getPatientAppointments,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  getAvailableSlots,
  getUpcomingAppointments
}; 