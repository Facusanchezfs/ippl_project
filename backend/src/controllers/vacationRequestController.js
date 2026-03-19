'use strict';

const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');
const { sequelize, VacationRequest, Appointment, User } = require('../../models');
const { toVacationRequestDTO, toVacationRequestDTOList } = require('../../mappers/VacationRequestMapper');
const { createActivity } = require('./activityController');
const logger = require('../utils/logger');
const { sendSuccess, sendError } = require('../utils/response');

function addDays(ymd, days) {
  const [y, m, d] = String(ymd).split('-').map((n) => parseInt(n, 10));
  const date = new Date(y, (m || 1) - 1, d || 1);
  date.setDate(date.getDate() + days);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function diffDaysInclusive(startYmd, endYmd) {
  const [sy, sm, sd] = String(startYmd).split('-').map((n) => parseInt(n, 10));
  const [ey, em, ed] = String(endYmd).split('-').map((n) => parseInt(n, 10));

  // Usar medianoche local para ser consistente con DATEONLY + lógica existente.
  const start = new Date(sy, (sm || 1) - 1, sd || 1);
  const end = new Date(ey, (em || 1) - 1, ed || 1);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  // Incluir ambos extremos: 1 día => 1, 7 días => 7.
  return diffDays + 1;
}

function rangesOverlap(startA, endA, startB, endB) {
  return startA <= endB && startB <= endA;
}

const createVacationRequest = async (req, res) => {
  try {
    const professionalId = req.user?.id;
    const professionalName = req.user?.name || null;
    const { startDate, weeksRequested, endDate: endDateInput, reason } = req.body;

    if (!professionalId) {
      return sendError(res, 401, 'Usuario no autenticado');
    }

    if (!startDate) {
      return sendError(res, 400, 'startDate es obligatorio');
    }

    let endDate;
    let weeks;

    // Nuevo formato: startDate + endDate (si viene endDate se usa directamente).
    if (endDateInput) {
      endDate = endDateInput;

      if (endDate < startDate) {
        return sendError(
          res,
          400,
          'endDate debe ser mayor o igual a startDate'
        );
      }

      // Mantener el campo requerido en el modelo (weeksRequested) aunque no venga en el request nuevo.
      const daysInclusive = diffDaysInclusive(startDate, endDate);
      weeks = Math.ceil(daysInclusive / 7);

      if (![1, 2, 3, 4].includes(weeks)) {
        return sendError(res, 400, 'weeksRequested debe ser 1, 2, 3 o 4');
      }
    } else {
      // Legacy: startDate + weeksRequested.
      if (!weeksRequested) {
        return sendError(
          res,
          400,
          'startDate y weeksRequested son obligatorios'
        );
      }

      weeks = Number(weeksRequested);
      if (![1, 2, 3, 4].includes(weeks)) {
        return sendError(
          res,
          400,
          'weeksRequested debe ser 1, 2, 3 o 4'
        );
      }

      endDate = addDays(startDate, weeks * 7 - 1);
    }

    const existingPending = await VacationRequest.findOne({
      where: {
        professionalId,
        status: 'pending',
      },
    });

    if (existingPending) {
      return sendError(
        res,
        400,
        'Ya existe una solicitud de vacaciones pendiente'
      );
    }

    const overlappingApproved = await VacationRequest.findOne({
      where: {
        professionalId,
        status: 'approved',
        startDate: { [Op.lte]: endDate },
        endDate: { [Op.gte]: startDate },
      },
    });

    if (overlappingApproved) {
      return sendError(
        res,
        400,
        'El rango de vacaciones se superpone con vacaciones ya aprobadas'
      );
    }

    const created = await VacationRequest.create({
      professionalId,
      startDate,
      endDate,
      weeksRequested: weeks,
      reason: reason || null,
      status: 'pending',
    });

    try {
      await createActivity(
        'VACATION_REQUESTED',
        'Solicitud de vacaciones',
        'El profesional ha solicitado vacaciones',
        {
          vacationRequestId: created.id,
          professionalId: String(professionalId),
          professionalName: professionalName || undefined,
          startDate,
          endDate,
          weeksRequested: weeks,
          reason: reason || undefined,
        }
      );
    } catch (err) {
      logger.warn(
        '[createVacationRequest] No se pudo registrar la actividad de solicitud de vacaciones:',
        err
      );
    }

    return sendSuccess(
      res,
      toVacationRequestDTO(created),
      'Solicitud de vacaciones creada correctamente',
      201
    );
  } catch (error) {
    logger.error(
      '[createVacationRequest] Error al crear solicitud de vacaciones:',
      error
    );
    return sendError(
      res,
      500,
      'Error al crear la solicitud de vacaciones'
    );
  }
};

const listVacationRequestsAdmin = async (req, res) => {
  try {
    const where = {};
    if (req.query.status) {
      where.status = req.query.status;
    }
    const requests = await VacationRequest.findAll({
      where,
      include: [
        {
          model: User,
          as: 'professional',
          attributes: ['id', 'name'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    return sendSuccess(
      res,
      { requests: toVacationRequestDTOList(requests) }
    );
  } catch (error) {
    logger.error(
      '[listVacationRequestsAdmin] Error al obtener solicitudes de vacaciones:',
      error
    );
    return sendError(
      res,
      500,
      'Error al obtener las solicitudes de vacaciones'
    );
  }
};

const listMyVacationRequests = async (req, res) => {
  try {
    const professionalId = req.user?.id;
    if (!professionalId) {
      return sendError(res, 401, 'Usuario no autenticado');
    }

    const requests = await VacationRequest.findAll({
      where: { professionalId },
      order: [['createdAt', 'DESC']],
    });

    return sendSuccess(
      res,
      { requests: toVacationRequestDTOList(requests) }
    );
  } catch (error) {
    logger.error(
      '[listMyVacationRequests] Error al obtener solicitudes de vacaciones del profesional:',
      error
    );
    return sendError(
      res,
      500,
      'Error al obtener tus solicitudes de vacaciones'
    );
  }
};

const approveVacationRequest = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await sequelize.transaction(async (t) => {
      const request = await VacationRequest.findByPk(id, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!request) {
        return { kind: 'not_found' };
      }

      if (request.status !== 'pending') {
        return { kind: 'already_processed' };
      }

      const overlappingApproved = await VacationRequest.findOne({
        where: {
          id: { [Op.ne]: request.id },
          professionalId: request.professionalId,
          status: 'approved',
          startDate: { [Op.lte]: request.endDate },
          endDate: { [Op.gte]: request.startDate },
        },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (overlappingApproved) {
        return { kind: 'overlap' };
      }

      const appointments = await Appointment.findAll({
        where: {
          professionalId: request.professionalId,
          date: {
            [Op.between]: [request.startDate, request.endDate],
          },
          status: {
            [Op.notIn]: ['completed', 'cancelled'],
          },
          active: true,
        },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      for (const appt of appointments) {
        appt.status = 'cancelled';
        await appt.save({ transaction: t });
      }

      request.status = 'approved';
      await request.save({ transaction: t });

      return { kind: 'ok', request, appointments };
    });

    if (result.kind === 'not_found') {
      return sendError(res, 404, 'Solicitud de vacaciones no encontrada');
    }

    if (result.kind === 'already_processed') {
      return sendError(
        res,
        400,
        'Esta solicitud de vacaciones ya fue procesada'
      );
    }

    if (result.kind === 'overlap') {
      return sendError(
        res,
        400,
        'El rango de esta solicitud se superpone con vacaciones ya aprobadas'
      );
    }

    const { request, appointments } = result;

    try {
      const logDir = path.join(__dirname, '../../../logs');
      const logPath = path.join(logDir, 'audit_log.txt');

      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const nowIso = new Date().toISOString();
      const vacationRequestId = String(request.id);
      const professionalIdStr = String(request.professionalId);

      let logBuffer = '';
      for (const appt of appointments) {
        logBuffer +=
          `[${nowIso}] PROFESSIONAL_ID=${professionalIdStr} ACTION: vacation_cancellation ` +
          `VACATION_REQUEST_ID=${vacationRequestId} APPOINTMENT_ID=${appt.id} ` +
          `DATE=${appt.date} START=${appt.startTime} END=${appt.endTime}\n`;
      }

      if (logBuffer) {
        fs.appendFile(logPath, logBuffer, (err) => {
          if (err) {
            logger.error(
              '[approveVacationRequest] Error writing audit log:',
              err
            );
          }
        });
      }
    } catch (logErr) {
      logger.error(
        '[approveVacationRequest] Audit log failure:',
        logErr
      );
    }

    try {
      await createActivity(
        'VACATION_APPROVED',
        'Solicitud de vacaciones aprobada',
        'Se aprobaron las vacaciones del profesional',
        {
          vacationRequestId: request.id,
          professionalId: String(request.professionalId),
          startDate: request.startDate,
          endDate: request.endDate,
          weeksRequested: request.weeksRequested,
          reason: request.reason || undefined,
        }
      );
    } catch (err) {
      logger.warn(
        '[approveVacationRequest] No se pudo registrar la actividad VACATION_APPROVED:',
        err
      );
    }

    return sendSuccess(
      res,
      toVacationRequestDTO(result.request),
      'Solicitud de vacaciones aprobada correctamente'
    );
  } catch (error) {
    logger.error(
      '[approveVacationRequest] Error al aprobar solicitud de vacaciones:',
      error
    );
    return sendError(
      res,
      500,
      'Error al aprobar la solicitud de vacaciones'
    );
  }
};

const rejectVacationRequest = async (req, res) => {
  const { id } = req.params;

  try {
    const request = await VacationRequest.findByPk(id);

    if (!request) {
      return sendError(res, 404, 'Solicitud de vacaciones no encontrada');
    }

    if (request.status !== 'pending') {
      return sendError(
        res,
        400,
        'Esta solicitud de vacaciones ya fue procesada'
      );
    }

    request.status = 'rejected';
    await request.save();

    try {
      await createActivity(
        'VACATION_REJECTED',
        'Solicitud de vacaciones rechazada',
        'Se rechazó la solicitud de vacaciones del profesional',
        {
          vacationRequestId: request.id,
          professionalId: String(request.professionalId),
          startDate: request.startDate,
          endDate: request.endDate,
          weeksRequested: request.weeksRequested,
          reason: request.reason || undefined,
        }
      );
    } catch (err) {
      logger.warn(
        '[rejectVacationRequest] No se pudo registrar la actividad VACATION_REJECTED:',
        err
      );
    }

    return sendSuccess(
      res,
      toVacationRequestDTO(request),
      'Solicitud de vacaciones rechazada correctamente'
    );
  } catch (error) {
    logger.error(
      '[rejectVacationRequest] Error al rechazar solicitud de vacaciones:',
      error
    );
    return sendError(
      res,
      500,
      'Error al rechazar la solicitud de vacaciones'
    );
  }
};

module.exports = {
  createVacationRequest,
  listVacationRequestsAdmin,
  listMyVacationRequests,
  approveVacationRequest,
  rejectVacationRequest,
};

