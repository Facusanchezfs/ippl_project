'use strict';
const { sequelize, StatusRequest, Patient } = require('../../models');
const { toStatusRequestDTO, toStatusRequestDTOList } = require('../../mappers/StatusRequestMapper');
const { createActivity } = require('./activityController');
const logger = require('../utils/logger');

const VALID_STATUSES = ['active', 'pending', 'inactive', 'absent', 'alta'];

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
      type, // opcional: 'activation' | 'status_change'
    } = req.body;

    // Validaciones básicas
    if (!patientId) {
      return res.status(400).json({ message: 'Falta patientId' });
    }
    if (!VALID_STATUSES.includes(currentStatus) || !VALID_STATUSES.includes(requestedStatus)) {
      return res.status(400).json({
        message: 'Estado no válido. Permitidos: active, pending, inactive, absent, alta',
      });
    }
    // Regla original: este endpoint permite únicamente active -> inactive
    if (currentStatus === 'active' && requestedStatus !== 'inactive') {
      return res.status(400).json({
        message: 'Solo se permiten solicitudes de cambio de estado de active a inactive',
      });
    }

    // Cargar paciente para snapshot y verificación
    const patient = await Patient.findByPk(patientId);
    if (!patient) {
      return res.status(404).json({ message: 'Paciente no encontrado' });
    }

    // Evitar duplicados pendientes para el mismo paciente
    const existingPending = await StatusRequest.findOne({
      where: { patientId, status: 'pending' },
    });
    if (existingPending) {
      return res.status(400).json({
        message: 'Ya existe una solicitud pendiente para este paciente',
      });
    }

    // Determinar profesional (si no viene en body, tomamos del usuario autenticado si existe)
    const professionalId = bodyProfessionalId ?? req.user?.id ?? null;
    const professionalName = snapProfessionalName ?? req.user?.name ?? null;

    const computedType =
      (currentStatus === 'pending' && requestedStatus !== 'pending')
      ? 'activation'
      : 'status_change';

    // Crear solicitud
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

    return res.status(201).json(toStatusRequestDTO(created));
  } catch (error) {
    logger.error('Error al crear solicitud:', error);
    return res.status(500).json({ message: 'Error al crear la solicitud' });
  }
};

// Obtener solicitudes pendientes
const getPendingRequests = async (req, res) => {
  try {
    const pending = await StatusRequest.findAll({
      where: { status: 'pending' },
      order: [['createdAt', 'DESC']],
    });

    return res.json({ requests: toStatusRequestDTOList(pending) });
  } catch (error) {
    logger.error('Error al obtener solicitudes:', error);
    return res.status(500).json({ message: 'Error al obtener las solicitudes' });
  }
};

// Obtener solicitudes de un profesional
const getProfessionalRequests = async (req, res) => {
  try {
    const { professionalId } = req.params;
    if (!professionalId) {
      return res.status(400).json({ message: 'Falta professionalId' });
    }

    const rows = await StatusRequest.findAll({
      where: { professionalId },
      order: [['createdAt', 'DESC']],
    });

    return res.json({ requests: toStatusRequestDTOList(rows) });
  } catch (error) {
    logger.error('Error al obtener solicitudes del profesional:', error);
    return res.status(500).json({ message: 'Error al obtener las solicitudes' });
  }
};

// Aprobar una solicitud de cambio de estado
const approveRequest = async (req, res) => {
  logger.debug('Llamada a approveRequest con ID:', { requestId: req.params.requestId });
  const { requestId } = req.params;
  const { adminResponse } = req.body;

  try {
    const result = await sequelize.transaction(async (t) => {
      // 1) Buscar la solicitud
      const request = await StatusRequest.findByPk(requestId, { transaction: t });
      if (!request) {
        return { kind: 'not_found' };
      }
      if (request.status !== 'pending') {
        return { kind: 'already_processed' };
      }

      // 2) Buscar paciente
      const patient = await Patient.findByPk(request.patientId, { transaction: t });
      if (!patient) {
        return { kind: 'patient_not_found' };
      }

      // 3) Actualizar estado del paciente según la solicitud
      const oldStatus = patient.status;
      const newStatus = request.requestedStatus;

      // Nota: no bloqueamos cambios desde/hacia "alta" (por tu decisión de negocio)
      patient.status = newStatus;
      await patient.save({ transaction: t });

      // 4) Marcar solicitud como aprobada
      request.status = 'approved';
      request.adminResponse = adminResponse ?? null;
      await request.save({ transaction: t });

      return { kind: 'ok', request, patient, oldStatus, newStatus };
    });

    // Manejo de resultados fuera de la transacción
    if (result.kind === 'not_found') {
      logger.debug('Solicitud no encontrada para ID:', { requestId });
      return res.status(404).json({ message: 'Solicitud no encontrada' });
    }
    if (result.kind === 'already_processed') {
      return res.status(400).json({ message: 'Esta solicitud ya fue procesada' });
    }
    if (result.kind === 'patient_not_found') {
      return res.status(404).json({ message: 'Paciente no encontrado' });
    }

    const { request, patient, oldStatus, newStatus } = result;

    // 5) Crear actividad (fuera de la tx; si falla el log, no rompemos la aprobación)
    try {
      const activityType =
        request.requestedStatus === 'alta'
          ? 'PATIENT_ACTIVATION_APPROVED'
          : 'STATUS_CHANGE_APPROVED';

      const title =
        activityType === 'PATIENT_ACTIVATION_APPROVED'
          ? 'Alta de paciente aprobada'
          : 'Cambio de estado aprobado';

      const description =
        activityType === 'PATIENT_ACTIVATION_APPROVED'
          ? `Se ha aprobado el alta para el paciente ${request.patientName}`
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

    // 6) Devolver DTO de la solicitud aprobada
    return res.json(toStatusRequestDTO(request));
  } catch (error) {
    logger.error('Error al aprobar solicitud:', error);
    return res.status(500).json({ message: 'Error al aprobar la solicitud' });
  }
};


// Rechazar una solicitud (status-request)
const rejectRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { adminResponse } = req.body;

    if (!adminResponse || !String(adminResponse).trim()) {
      return res.status(400).json({ message: 'Se requiere una razón para el rechazo' });
    }

    // Traer la solicitud
    const sr = await StatusRequest.findByPk(requestId);
    if (!sr) {
      return res.status(404).json({ message: 'Solicitud no encontrada' });
    }
    if (sr.status !== 'pending') {
      return res.status(400).json({ message: 'Esta solicitud ya fue procesada' });
    }

    // (Opcional) Traer paciente para validar existencia/estado actual (no modificamos al paciente en un rechazo)
    const patient = await Patient.findByPk(sr.patientId);
    if (!patient) {
      return res.status(404).json({ message: 'Paciente no encontrado' });
    }

    // Transacción para garantizar consistencia entre la actualización y la actividad
    let t;
    try {
      t = await sequelize.transaction();

      // Rechazar solicitud
      sr.status = 'rejected';
      sr.adminResponse = adminResponse;
      await sr.save({ transaction: t });

      // Registrar actividad (el cliente espera STATUS_CHANGE_* para status)
      // Para "alta" (alta médica) también usamos STATUS_CHANGE_REJECTED para que el front la capte.
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
        { transaction: t } // si tu createActivity soporta options; si no, quita este arg.
      );

      await t.commit();
    } catch (err) {
      if (t) await t.rollback();
      throw err;
    }

    // Refrescar y devolver DTO
    await sr.reload();
    return res.json(toStatusRequestDTO(sr));
  } catch (error) {
    logger.error('Error al rechazar solicitud:', error);
    return res.status(500).json({ message: 'Error al rechazar la solicitud' });
  }
};

module.exports = {
  createRequest,
  getPendingRequests,
  getProfessionalRequests,
  approveRequest,
  rejectRequest,
}; 