'use strict';
const { Op } = require('sequelize');
const { sequelize, StatusRequest, Patient } = require('../../models');
const { toStatusRequestDTO, toStatusRequestDTOList } = require('../../mappers/StatusRequestMapper');
const { createActivity } = require('./activityController');
const logger = require('../utils/logger');
const { sendSuccess, sendError } = require('../utils/response');

const VALID_STATUSES = ['active', 'pending', 'inactive'];

const createRequest = async (req, res) => {
  try {
    const {
      patientId,
      patientName: snapPatientName,
      professionalId: bodyProfessionalId,
      professionalName: snapProfessionalName,
      currentStatus,
      requestedStatus,
      reason,
      type,
    } = req.body;

    if (!patientId) {
      return sendError(res, 400, 'Falta patientId');
    }
    if (!VALID_STATUSES.includes(currentStatus) || !VALID_STATUSES.includes(requestedStatus)) {
      return sendError(res, 400, 'Estado no válido. Permitidos: active, pending, inactive');
    }
    if (currentStatus === 'active' && requestedStatus !== 'inactive') {
      return sendError(res, 400, 'Solo se permiten solicitudes de cambio de estado de active a inactive');
    }

    const patient = await Patient.findByPk(patientId);
    if (!patient || !patient.active) {
      return sendError(res, 404, 'Paciente no encontrado');
    }

    const existingPending = await StatusRequest.findOne({
      where: { patientId, status: 'pending' },
    });
    if (existingPending) {
      return sendError(res, 400, 'Ya existe una solicitud pendiente para este paciente');
    }

    const professionalId = bodyProfessionalId ?? req.user?.id ?? null;
    const professionalName = snapProfessionalName ?? req.user?.name ?? null;

    const computedType =
      (currentStatus === 'pending' && requestedStatus !== 'pending')
      ? 'activation'
      : 'status_change';

    const created = await StatusRequest.create({
      patientId,
      patientName: snapPatientName ?? patient.name,
      professionalId,
      professionalName,
      currentStatus,
      requestedStatus,
      reason: reason ?? null,
      status: 'pending',
      type: type ?? computedType,
    });

    return sendSuccess(res, toStatusRequestDTO(created), 'Solicitud creada correctamente', 201);
  } catch (error) {
    logger.error('Error al crear solicitud:', error);
    return sendError(res, 500, 'Error al crear la solicitud');
  }
};

const getPendingRequests = async (req, res) => {
  try {
    const activePatients = await Patient.findAll({
      where: { active: true },
      attributes: ['id'],
      raw: true,
    });
    const activePatientIds = activePatients.map(p => p.id);

    const pending = await StatusRequest.findAll({
      where: { 
        status: 'pending',
        patientId: activePatientIds.length > 0 ? { [Op.in]: activePatientIds } : { [Op.in]: [] }
      },
      order: [['createdAt', 'DESC']],
    });

    return sendSuccess(res, { requests: toStatusRequestDTOList(pending) });
  } catch (error) {
    logger.error('Error al obtener solicitudes:', error);
    return sendError(res, 500, 'Error al obtener las solicitudes');
  }
};

const getProfessionalRequests = async (req, res) => {
  try {
    const { professionalId } = req.params;
    if (!professionalId) {
      return sendError(res, 400, 'Falta professionalId');
    }

    const activePatients = await Patient.findAll({
      where: { active: true },
      attributes: ['id'],
      raw: true,
    });
    const activePatientIds = activePatients.map(p => p.id);

    const rows = await StatusRequest.findAll({
      where: { 
        professionalId,
        patientId: activePatientIds.length > 0 ? { [Op.in]: activePatientIds } : { [Op.in]: [] }
      },
      order: [['createdAt', 'DESC']],
    });

    return sendSuccess(res, { requests: toStatusRequestDTOList(rows) });
  } catch (error) {
    logger.error('Error al obtener solicitudes del profesional:', error);
    return sendError(res, 500, 'Error al obtener las solicitudes');
  }
};

const getPatientPendingRequests = async (req, res) => {
  try {
    const { patientId } = req.params;
    if (!patientId) {
      return sendError(res, 400, 'Falta patientId');
    }

    const patient = await Patient.findByPk(patientId);
    if (!patient || !patient.active) {
      return sendError(res, 404, 'Paciente no encontrado');
    }

    const rows = await StatusRequest.findAll({
      where: { 
        patientId,
        status: 'pending' 
      },
      order: [['createdAt', 'DESC']],
    });

    return sendSuccess(res, { requests: toStatusRequestDTOList(rows) });
  } catch (error) {
    logger.error('Error al obtener solicitudes pendientes del paciente:', error);
    return sendError(res, 500, 'Error al obtener las solicitudes');
  }
};

const approveRequest = async (req, res) => {
  logger.debug('Llamada a approveRequest con ID:', { requestId: req.params.requestId });
  const { requestId } = req.params;
  const { adminResponse } = req.body;

  try {
    const result = await sequelize.transaction(async (t) => {
      const request = await StatusRequest.findByPk(requestId, { transaction: t });
      if (!request) {
        return { kind: 'not_found' };
      }
      if (request.status !== 'pending') {
        return { kind: 'already_processed' };
      }

      const patient = await Patient.findByPk(request.patientId, { transaction: t });
      if (!patient || !patient.active) {
        return { kind: 'patient_not_found' };
      }

      const oldStatus = patient.status;
      const newStatus = request.requestedStatus;

      patient.status = newStatus;
      
      if (request.type === 'activation' && newStatus === 'active') {
        patient.activatedAt = new Date();
      }
      
      await patient.save({ transaction: t });

      request.status = 'approved';
      request.adminResponse = adminResponse ?? null;
      await request.save({ transaction: t });

      return { kind: 'ok', request, patient, oldStatus, newStatus };
    });

    if (result.kind === 'not_found') {
      logger.debug('Solicitud no encontrada para ID:', { requestId });
      return sendError(res, 404, 'Solicitud no encontrada');
    }
    if (result.kind === 'already_processed') {
      return sendError(res, 400, 'Esta solicitud ya fue procesada');
    }
    if (result.kind === 'patient_not_found') {
      return sendError(res, 404, 'Paciente no encontrado');
    }

    const { request, patient, oldStatus, newStatus } = result;

    try {
      const activityType =
        request.type === 'activation'
          ? 'PATIENT_ACTIVATION_APPROVED'
          : 'STATUS_CHANGE_APPROVED';

      const title =
        activityType === 'PATIENT_ACTIVATION_APPROVED'
          ? 'Activación de paciente aprobada'
          : 'Cambio de estado aprobado';

      const description =
        activityType === 'PATIENT_ACTIVATION_APPROVED'
          ? `Se ha aprobado la activación para el paciente ${request.patientName}`
          : `Se ha aprobado el cambio de estado para el paciente ${request.patientName} de ${oldStatus} a ${newStatus}`;

      await createActivity(activityType, title, description, {
        patientId: String(request.patientId),
        patientName: request.patientName,
        professionalId: request.professionalId ? String(request.professionalId) : undefined,
        professionalName: request.professionalName,
        oldStatus,
        newStatus,
        adminResponse: adminResponse ?? undefined,
      });
    } catch (logErr) {
      logger.warn('No se pudo registrar la actividad de aprobación:', logErr);
    }

    return sendSuccess(res, toStatusRequestDTO(request), 'Solicitud aprobada correctamente');
  } catch (error) {
    logger.error('Error al aprobar solicitud:', error);
    return sendError(res, 500, 'Error al aprobar la solicitud');
  }
};


const rejectRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { adminResponse } = req.body;

    if (!adminResponse || !String(adminResponse).trim()) {
      return sendError(res, 400, 'Se requiere una razón para el rechazo');
    }

    const sr = await StatusRequest.findByPk(requestId);
    if (!sr) {
      return sendError(res, 404, 'Solicitud no encontrada');
    }
    if (sr.status !== 'pending') {
      return sendError(res, 400, 'Esta solicitud ya fue procesada');
    }

    const patient = await Patient.findByPk(sr.patientId);
    if (!patient || !patient.active) {
      return sendError(res, 404, 'Paciente no encontrado');
    }

    let t;
    try {
      t = await sequelize.transaction();

      sr.status = 'rejected';
      sr.adminResponse = adminResponse;
      await sr.save({ transaction: t });

      await createActivity(
        'STATUS_CHANGE_REJECTED',
        'Cambio de estado rechazado',
        `Se ha rechazado el cambio de estado para el paciente ${sr.patientName}`,
        {
          patientId: String(sr.patientId ?? ''),
          patientName: sr.patientName,
          professionalId: String(sr.professionalId ?? ''),
          professionalName: sr.professionalName,
          requestedStatus: sr.requestedStatus,
          currentStatus: sr.currentStatus,
          reason: adminResponse,
        },
        { transaction: t }
      );

      await t.commit();
    } catch (err) {
      if (t) await t.rollback();
      throw err;
    }

    await sr.reload();
    return sendSuccess(res, toStatusRequestDTO(sr), 'Solicitud rechazada correctamente');
  } catch (error) {
    logger.error('Error al rechazar solicitud:', error);
    return sendError(res, 500, 'Error al rechazar la solicitud');
  }
};

module.exports = {
  createRequest,
  getPendingRequests,
  getProfessionalRequests,
  getPatientPendingRequests,
  approveRequest,
  rejectRequest,
}; 