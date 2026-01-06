const express = require('express');
const router = express.Router();
const { authenticateToken, checkRole } = require('../middleware/auth');

const { sequelize, Patient, FrequencyRequest } = require('../../models');
const { toFrequencyRequestDTO, toFrequencyRequestDTOList } = require('../../mappers/FrequencyRequestMapper');

const { createActivity } = require('../controllers/activityController');
const logger = require('../utils/logger');
const { sendSuccess, sendError } = require('../utils/response');

router.post(
  '/',
  authenticateToken,
  checkRole(['professional']),
  async (req, res) => {
    try {
      const { patientId, newFrequency, reason } = req.body;
      const { id: professionalId, name: professionalName } = req.user;

      if (!patientId || !newFrequency || !reason) {
        return sendError(res, 400, 'Faltan campos requeridos. Se necesita: patientId, newFrequency y reason');
      }

      const validFrequencies = ['weekly', 'biweekly', 'monthly'];
      if (!validFrequencies.includes(newFrequency)) {
        return sendError(res, 400, 'Frecuencia no válida. Las frecuencias permitidas son: weekly, biweekly, monthly');
      }

      if (!reason.trim()) {
        return sendError(res, 400, 'La razón del cambio no puede estar vacía');
      }

      const patient = await Patient.findByPk(patientId);
      if (!patient) {
        return sendError(res, 404, 'Paciente no encontrado');
      }

      if (String(patient.professionalId ?? '') !== String(professionalId)) {
        return sendError(res, 403, 'No tienes permiso para modificar este paciente');
      }

      const isFirstAssignment = !patient.sessionFrequency; // null/undefined
      const currentForRequest = isFirstAssignment ? newFrequency : patient.sessionFrequency;

      if (!isFirstAssignment && patient.sessionFrequency === newFrequency) {
        return sendError(res, 400, 'La nueva frecuencia debe ser diferente a la frecuencia actual');
      }

      const existing = await FrequencyRequest.findOne({
        where: { patientId, status: 'pending' },
      });
      if (existing) {
        return sendError(res, 400, 'Ya existe una solicitud pendiente para este paciente');
      }

      const created = await FrequencyRequest.create({
        patientId,
        patientName: patient.name,
        professionalId,
        professionalName,
        currentFrequency: currentForRequest,
        requestedFrequency: newFrequency,
        reason,
        status: 'pending',
      });

      const verbo = isFirstAssignment ? 'asignar' : 'cambiar';
      await createActivity(
        'FREQUENCY_CHANGE_REQUESTED',
        'Nueva solicitud de cambio de frecuencia',
        `${professionalName} ha solicitado ${verbo} la frecuencia de sesiones de ${patient.name} a ${newFrequency}`,
        {
          requestId: created.id,
          patientId,
          patientName: patient.name,
          professionalId,
          professionalName,
          currentFrequency: currentForRequest,
          requestedFrequency: newFrequency,
        }
      );

      return sendSuccess(res, toFrequencyRequestDTO(created), 'Solicitud creada exitosamente', 201);
    } catch (error) {
      logger.error('Error al crear solicitud:', error);
      return sendError(res, 500, 'Error al crear la solicitud');
    }
  }
);



router.get(
  '/pending',
  authenticateToken,
  checkRole(['admin', 'financial']),
  async (req, res) => {
    try {
      const pending = await FrequencyRequest.findAll({
        where: { status: 'pending' },
        order: [['createdAt', 'DESC']],
      });

      return sendSuccess(res, toFrequencyRequestDTOList(pending));
    } catch (error) {
      logger.error('Error al obtener solicitudes:', error);
      return sendError(res, 500, 'Error al obtener las solicitudes');
    }
  }
);


router.get(
  '/patient/:patientId',
  authenticateToken,
  checkRole(['admin', 'professional', 'financial']),
  async (req, res) => {
    try {
      const { patientId } = req.params;

      const requests = await FrequencyRequest.findAll({
        where: { patientId },
        order: [['createdAt', 'DESC']],
      });

      return sendSuccess(res, toFrequencyRequestDTOList(requests));
    } catch (error) {
      logger.error('Error al obtener solicitudes del paciente:', error);
      return sendError(res, 500, 'Error al obtener las solicitudes');
    }
  }
);


router.post(
  '/:requestId/approve',
  authenticateToken,
  checkRole(['admin']),
  async (req, res) => {
    const { requestId } = req.params;
    const { adminResponse } = req.body;

    try {
      let snapshot;

      await sequelize.transaction(async (t) => {
        const request = await FrequencyRequest.findByPk(requestId, {
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (!request) {
          const err = new Error('Solicitud no encontrada');
          err.status = 404;
          throw err;
        }
        if (request.status !== 'pending') {
          const err = new Error('Esta solicitud ya fue procesada');
          err.status = 400;
          throw err;
        }

        const patient = await Patient.findByPk(request.patientId, {
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (!patient) {
          const err = new Error('Paciente no encontrado');
          err.status = 404;
          throw err;
        }

        await patient.update(
          { sessionFrequency: request.requestedFrequency },
          { transaction: t }
        );

        await request.update(
          {
            status: 'approved',
            adminResponse: adminResponse ?? request.adminResponse ?? '',
          },
          { transaction: t }
        );

        snapshot = request.get({ plain: true });
      });

      await createActivity(
        'FREQUENCY_CHANGE_APPROVED',
        'Solicitud de cambio de frecuencia aprobada',
        `Se ha aprobado la frecuencia para ${snapshot.patientName} a ${snapshot.requestedFrequency}`,
        {
          requestId: snapshot.id,
          patientId: snapshot.patientId,
          patientName: snapshot.patientName,
          professionalId: snapshot.professionalId,
          professionalName: snapshot.professionalName,
          currentFrequency: snapshot.currentFrequency,
          requestedFrequency: snapshot.requestedFrequency,
          newFrequency: snapshot.requestedFrequency,
        }
      );

      return sendSuccess(res, toFrequencyRequestDTO(snapshot), 'Solicitud aprobada exitosamente');
    } catch (error) {
      const status = error.status || 500;
      if (status !== 500) {
        return sendError(res, status, error.message);
      }
      logger.error('Error al aprobar solicitud:', error);
      return sendError(res, 500, 'Error al aprobar la solicitud');
    }
  }
);

module.exports = router;



router.post(
  '/:requestId/reject',
  authenticateToken,
  checkRole(['admin']),
  async (req, res) => {
    const { requestId } = req.params;
    const { adminResponse } = req.body;

    try {
      if (!adminResponse || !String(adminResponse).trim()) {
        return sendError(res, 400, 'Se requiere una razón para el rechazo');
      }

      let snapshot;

      await sequelize.transaction(async (t) => {
        const request = await FrequencyRequest.findByPk(requestId, {
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (!request) {
          const err = new Error('Solicitud no encontrada');
          err.status = 404;
          throw err;
        }
        if (request.status !== 'pending') {
          const err = new Error('Esta solicitud ya fue procesada');
          err.status = 400;
          throw err;
        }

        await request.update(
          {
            status: 'rejected',
            adminResponse: String(adminResponse).trim(),
          },
          { transaction: t }
        );

        snapshot = request.get({ plain: true });
      });

      await createActivity(
        'FREQUENCY_CHANGE_REJECTED',
        'Solicitud de cambio de frecuencia rechazada',
        `Se ha rechazado la frecuencia solicitada para ${snapshot.patientName}`,
        {
          requestId: snapshot.id,
          patientId: String(snapshot.patientId ?? ''),
          patientName: snapshot.patientName,
          professionalId: String(snapshot.professionalId ?? ''),
          professionalName: snapshot.professionalName,
          requestedFrequency: snapshot.requestedFrequency,
          currentFrequency: snapshot.currentFrequency,
        }
      );

      return sendSuccess(res, toFrequencyRequestDTO(snapshot), 'Solicitud rechazada exitosamente');
    } catch (error) {
      const status = error.status || 500;
      if (status !== 500) {
        return sendError(res, status, error.message);
      }
      logger.error('Error al rechazar solicitud:', error);
      return sendError(res, 500, 'Error al rechazar la solicitud');
    }
  }
);

module.exports = router; 