const { sequelize, Appointment, AppointmentCancellationRequest } = require('../../models');
const {
  toAppointmentCancellationRequestDTO,
  toAppointmentCancellationRequestDTOList,
} = require('../../mappers/AppointmentCancellationRequestMapper');
const { createActivity } = require('./activityController');
const logger = require('../utils/logger');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Profesional crea una solicitud de cancelación de cita.
 * Reglas:
 * - La cita debe existir.
 * - La cita debe estar en estado "scheduled".
 * - El profesional debe ser dueño de la cita.
 * - Solo puede existir una solicitud pending por cita.
 */
const createCancellationRequest = async (req, res) => {
  try {
    const { appointmentId, reason } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, 401, 'Usuario no autenticado');
    }

    const appointment = await Appointment.findByPk(appointmentId);

    if (!appointment || !appointment.active) {
      return sendError(res, 404, 'Cita no encontrada');
    }

    if (appointment.status !== 'scheduled') {
      return sendError(
        res,
        400,
        'Solo se pueden solicitar cancelaciones para citas programadas'
      );
    }

    const isOwner =
      String(appointment.professionalId ?? '') === String(userId ?? '');

    if (!isOwner) {
      return sendError(res, 403, 'No tienes permiso para cancelar esta cita');
    }

    const existingPending = await AppointmentCancellationRequest.findOne({
      where: {
        appointmentId,
        status: 'pending',
      },
    });

    if (existingPending) {
      return sendError(
        res,
        400,
        'Ya existe una solicitud de cancelación pendiente para esta cita'
      );
    }

    const created = await AppointmentCancellationRequest.create({
      appointmentId,
      professionalId: userId,
      reason,
      status: 'pending',
      reviewedBy: null,
      reviewedAt: null,
    });

    // Notificación para administradores mediante el sistema de actividades
    try {
      await createActivity(
        'APPOINTMENT_CANCELLATION_REQUESTED',
        'Solicitud de cancelación de cita',
        `El profesional ha solicitado la cancelación de la cita ${appointment.id}`,
        {
          cancellationRequestId: created.id,
          appointmentId: appointment.id,
          patientId: appointment.patientId != null ? String(appointment.patientId) : undefined,
          patientName: appointment.patientName,
          professionalId: appointment.professionalId != null ? String(appointment.professionalId) : undefined,
          professionalName: appointment.professionalName,
          date: appointment.date,
          startTime: appointment.startTime,
          endTime: appointment.endTime,
          reason,
        }
      );
    } catch (logErr) {
      logger.warn(
        '[createCancellationRequest] No se pudo registrar la actividad de solicitud de cancelación:',
        logErr
      );
    }

    return sendSuccess(
      res,
      toAppointmentCancellationRequestDTO(created),
      'Solicitud de cancelación creada correctamente',
      201
    );
  } catch (error) {
    logger.error(
      '[createCancellationRequest] Error al crear solicitud de cancelación:',
      error
    );
    return sendError(
      res,
      500,
      'Error al crear la solicitud de cancelación de cita',
      {
        message: error?.message || 'Error interno sin mensaje',
        name: error?.name || 'Error',
      }
    );
  }
};

/**
 * Lista todas las solicitudes de cancelación (para administración).
 */
const listCancellationRequests = async (req, res) => {
  try {
    const rows = await AppointmentCancellationRequest.findAll({
      include: [
        {
          model: Appointment,
          as: 'appointment',
          attributes: [
            'id',
            'date',
            'startTime',
            'endTime',
            'patientName',
            'professionalName',
          ],
        },
      ],
      order: [
        ['status', 'ASC'],
        ['createdAt', 'DESC'],
      ],
    });

    return sendSuccess(res, {
      requests: toAppointmentCancellationRequestDTOList(rows),
    });
  } catch (error) {
    logger.error(
      '[listCancellationRequests] Error al obtener solicitudes de cancelación:',
      error
    );
    return sendError(
      res,
      500,
      'Error al obtener las solicitudes de cancelación de citas'
    );
  }
};

/**
 * Aprueba una solicitud de cancelación.
 * Efecto:
 * - request.status = 'approved'
 * - appointment.status = 'cancelled'
 * - request.reviewedBy = adminId
 * - request.reviewedAt = now
 */
const approveCancellationRequest = async (req, res) => {
  const { id } = req.params;
  const reviewerId = req.user?.id;

  if (!reviewerId) {
    return sendError(res, 401, 'Usuario no autenticado');
  }

  try {
    const result = await sequelize.transaction(async (t) => {
      const request = await AppointmentCancellationRequest.findByPk(id, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!request) {
        return { kind: 'not_found' };
      }

      if (request.status !== 'pending') {
        return { kind: 'already_processed' };
      }

      const appointment = await Appointment.findByPk(request.appointmentId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!appointment) {
        return { kind: 'appointment_not_found' };
      }

      if (!appointment.active) {
        return { kind: 'appointment_inactive' };
      }

      if (appointment.status !== 'scheduled') {
        return { kind: 'not_scheduled' };
      }

      appointment.status = 'cancelled';
      await appointment.save({ transaction: t });

      request.status = 'approved';
      request.reviewedBy = reviewerId;
      request.reviewedAt = new Date();
      await request.save({ transaction: t });

      return { kind: 'ok', request };
    });

    if (result.kind === 'not_found') {
      return sendError(res, 404, 'Solicitud de cancelación no encontrada');
    }

    if (result.kind === 'already_processed') {
      return sendError(
        res,
        400,
        'Esta solicitud de cancelación ya fue procesada'
      );
    }

    if (result.kind === 'appointment_not_found') {
      return sendError(res, 404, 'Cita asociada no encontrada');
    }

    if (result.kind === 'appointment_inactive') {
      return sendError(res, 400, 'Cita asociada no disponible');
    }

    if (result.kind === 'not_scheduled') {
      return sendError(
        res,
        400,
        'Solo se pueden cancelar citas que estén programadas (scheduled)'
      );
    }

    const request = result.request;

    // Registrar actividad para admin y profesional
    try {
      const appointment = await Appointment.findByPk(request.appointmentId);
      if (appointment) {
        await createActivity(
          'APPOINTMENT_CANCELLATION_APPROVED',
          'Cancelación de cita aprobada',
          `Se aprobó la cancelación de la cita con ${appointment.patientName}.`,
          {
            cancellationRequestId: request.id,
            appointmentId: appointment.id,
            patientId:
              appointment.patientId != null ? String(appointment.patientId) : undefined,
            patientName: appointment.patientName,
            professionalId:
              appointment.professionalId != null
                ? String(appointment.professionalId)
                : undefined,
            professionalName: appointment.professionalName,
            date: appointment.date,
            startTime: appointment.startTime,
            endTime: appointment.endTime,
            reason: request.reason,
            decision: 'approved',
          }
        );
      }
    } catch (logErr) {
      logger.warn(
        '[approveCancellationRequest] No se pudo registrar la actividad de aprobación de cancelación:',
        logErr
      );
    }

    const dto = toAppointmentCancellationRequestDTO(request);
    return sendSuccess(
      res,
      dto,
      'Solicitud de cancelación aprobada correctamente'
    );
  } catch (error) {
    logger.error(
      '[approveCancellationRequest] Error al aprobar solicitud de cancelación:',
      error
    );
    return sendError(
      res,
      500,
      'Error al aprobar la solicitud de cancelación de cita'
    );
  }
};

/**
 * Rechaza una solicitud de cancelación.
 * Efecto:
 * - request.status = 'rejected'
 * - request.reviewedBy = adminId
 * - request.reviewedAt = now
 * La cita NO se modifica.
 */
const rejectCancellationRequest = async (req, res) => {
  const { id } = req.params;
  const reviewerId = req.user?.id;

  if (!reviewerId) {
    return sendError(res, 401, 'Usuario no autenticado');
  }

  try {
    const request = await AppointmentCancellationRequest.findByPk(id);

    if (!request) {
      return sendError(res, 404, 'Solicitud de cancelación no encontrada');
    }

    if (request.status !== 'pending') {
      return sendError(
        res,
        400,
        'Esta solicitud de cancelación ya fue procesada'
      );
    }

    request.status = 'rejected';
    request.reviewedBy = reviewerId;
    request.reviewedAt = new Date();
    await request.save();

    // Registrar actividad para admin y profesional
    try {
      const appointment = await Appointment.findByPk(request.appointmentId);
      if (appointment) {
        await createActivity(
          'APPOINTMENT_CANCELLATION_REJECTED',
          'Cancelación de cita rechazada',
          `Se rechazó la cancelación de la cita con ${appointment.patientName}.`,
          {
            cancellationRequestId: request.id,
            appointmentId: appointment.id,
            patientId:
              appointment.patientId != null ? String(appointment.patientId) : undefined,
            patientName: appointment.patientName,
            professionalId:
              appointment.professionalId != null
                ? String(appointment.professionalId)
                : undefined,
            professionalName: appointment.professionalName,
            date: appointment.date,
            startTime: appointment.startTime,
            endTime: appointment.endTime,
            reason: request.reason,
            decision: 'rejected',
          }
        );
      }
    } catch (logErr) {
      logger.warn(
        '[rejectCancellationRequest] No se pudo registrar la actividad de rechazo de cancelación:',
        logErr
      );
    }

    const dto = toAppointmentCancellationRequestDTO(request);
    return sendSuccess(
      res,
      dto,
      'Solicitud de cancelación rechazada correctamente'
    );
  } catch (error) {
    logger.error(
      '[rejectCancellationRequest] Error al rechazar solicitud de cancelación:',
      error
    );
    return sendError(
      res,
      500,
      'Error al rechazar la solicitud de cancelación de cita'
    );
  }
};

module.exports = {
  createCancellationRequest,
  listCancellationRequests,
  approveCancellationRequest,
  rejectCancellationRequest,
};

