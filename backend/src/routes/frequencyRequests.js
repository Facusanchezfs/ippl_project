const express = require('express');
const router = express.Router();
const { authenticateToken, checkRole } = require('../middleware/auth');

const { sequelize, Patient, FrequencyRequest } = require('../../models');
const { toFrequencyRequestDTO, toFrequencyRequestDTOList } = require('../../mappers/FrequencyRequestMapper');

const { createActivity } = require('../controllers/activityController');

// Crear una nueva solicitud
// POST /frequency-requests
router.post(
  '/',
  authenticateToken,
  checkRole(['professional']),
  async (req, res) => {
    try {
      const { patientId, newFrequency, reason } = req.body;
      const { id: professionalId, name: professionalName } = req.user;

      // Validaciones básicas
      if (!patientId || !newFrequency || !reason) {
        return res.status(400).json({
          message: 'Faltan campos requeridos. Se necesita: patientId, newFrequency y reason',
        });
      }

      const validFrequencies = ['weekly', 'biweekly', 'monthly'];
      if (!validFrequencies.includes(newFrequency)) {
        return res.status(400).json({
          message: 'Frecuencia no válida. Las frecuencias permitidas son: weekly, biweekly, monthly',
        });
      }

      if (!reason.trim()) {
        return res.status(400).json({ message: 'La razón del cambio no puede estar vacía' });
      }

      // Buscar paciente
      const patient = await Patient.findByPk(patientId);
      if (!patient) {
        return res.status(404).json({ message: 'Paciente no encontrado' });
      }

      // Debe estar asignado al profesional que solicita
      if (String(patient.professionalId ?? '') !== String(professionalId)) {
        return res.status(403).json({ message: 'No tienes permiso para modificar este paciente' });
      }

      // ¿Es primera asignación?
      const isFirstAssignment = !patient.sessionFrequency; // null/undefined
      const currentForRequest = isFirstAssignment ? newFrequency : patient.sessionFrequency;

      // Si NO es primera asignación, la nueva debe ser distinta
      if (!isFirstAssignment && patient.sessionFrequency === newFrequency) {
        return res.status(400).json({
          message: 'La nueva frecuencia debe ser diferente a la frecuencia actual',
        });
      }

      // Verificar pendiente existente
      const existing = await FrequencyRequest.findOne({
        where: { patientId, status: 'pending' },
      });
      if (existing) {
        return res.status(400).json({ message: 'Ya existe una solicitud pendiente para este paciente' });
      }

      // Crear solicitud
      const created = await FrequencyRequest.create({
        patientId,
        patientName: patient.name,
        professionalId,
        professionalName,
        currentFrequency: currentForRequest,    // siempre un valor válido
        requestedFrequency: newFrequency,
        reason,
        status: 'pending',
      });

      // Actividad: “asignar” si es la primera, “cambiar” si ya tenía
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

      return res.status(201).json(toFrequencyRequestDTO(created));
    } catch (error) {
      console.error('Error al crear solicitud:', error);
      return res.status(500).json({ message: 'Error al crear la solicitud' });
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

      return res.json(toFrequencyRequestDTOList(pending));
    } catch (error) {
      console.error('Error al obtener solicitudes:', error);
      return res.status(500).json({ message: 'Error al obtener las solicitudes' });
    }
  }
);


// GET /frequency-requests/patient/:patientId
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

      return res.json(toFrequencyRequestDTOList(requests));
    } catch (error) {
      console.error('Error al obtener solicitudes del paciente:', error);
      return res.status(500).json({ message: 'Error al obtener las solicitudes' });
    }
  }
);


// POST /frequency-requests/:requestId/approve
router.post(
  '/:requestId/approve',
  authenticateToken,
  checkRole(['admin']),
  async (req, res) => {
    const { requestId } = req.params;
    const { adminResponse } = req.body;

    try {
      let snapshot; // para responder y crear actividad luego del commit

      await sequelize.transaction(async (t) => {
        // 1) Buscar la solicitud con lock
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

        // 2) Buscar paciente con lock
        const patient = await Patient.findByPk(request.patientId, {
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (!patient) {
          const err = new Error('Paciente no encontrado');
          err.status = 404;
          throw err;
        }

        // 3) Actualizar frecuencia del paciente
        await patient.update(
          { sessionFrequency: request.requestedFrequency },
          { transaction: t }
        );

        // 4) Marcar solicitud como aprobada
        await request.update(
          {
            status: 'approved',
            adminResponse: adminResponse ?? request.adminResponse ?? '',
          },
          { transaction: t }
        );

        // Tomar snapshot para usar fuera de la transacción
        snapshot = request.get({ plain: true });
      }); // ← si todo va bien, COMMIT automático; si algo lanza error, ROLLBACK

      // 5) Side-effect fuera de la TX (actividad)
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
          newFrequency: snapshot.requestedFrequency,
        }
      );

      // 6) Responder al cliente con DTO
      return res.json(toFrequencyRequestDTO(snapshot));
    } catch (error) {
      const status = error.status || 500;
      if (status !== 500) {
        return res.status(status).json({ message: error.message });
      }
      console.error('Error al aprobar solicitud:', error);
      return res.status(500).json({ message: 'Error al aprobar la solicitud' });
    }
  }
);

module.exports = router;



// POST /frequency-requests/:requestId/reject
router.post(
  '/:requestId/reject',
  authenticateToken,
  checkRole(['admin']),
  async (req, res) => {
    const { requestId } = req.params;
    const { adminResponse } = req.body;

    try {
      if (!adminResponse || !String(adminResponse).trim()) {
        return res.status(400).json({ message: 'Se requiere una razón para el rechazo' });
      }

      let snapshot;

      await sequelize.transaction(async (t) => {
        // 1) Buscar la solicitud con lock
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

        // 2) Marcar como rechazada
        await request.update(
          {
            status: 'rejected',
            adminResponse: String(adminResponse).trim(),
          },
          { transaction: t }
        );

        snapshot = request.get({ plain: true });
      });

      // 3) Actividad fuera de la transacción
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

      // 4) Respuesta
      return res.json(toFrequencyRequestDTO(snapshot));
    } catch (error) {
      const status = error.status || 500;
      if (status !== 500) {
        return res.status(status).json({ message: error.message });
      }
      console.error('Error al rechazar solicitud:', error);
      return res.status(500).json({ message: 'Error al rechazar la solicitud' });
    }
  }
);

module.exports = router; 