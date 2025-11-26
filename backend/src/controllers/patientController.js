'use strict';
const { Patient, Derivation, User, StatusRequest } = require('../../models');
const { toPatientDTO } = require('../../mappers/PatientMapper');
const { createActivity } = require('./activityController');
const logger = require('../utils/logger');
const { sendSuccess, sendError } = require('../utils/response');

// Obtener todos los pacientes con su última derivación
async function getAllPatients(req, res) {
  try {
    // OPTIMIZACIÓN CRÍTICA #2: getAllPatients - N+1 Queries
    // PROBLEMA: separate: true genera 1 query adicional por cada paciente (N+1)
    // IMPACTO: Con 100 pacientes = 101 queries (1 principal + 100 derivaciones), 200-500ms
    // SOLUCIÓN: Obtener todas las derivaciones en una sola query y agrupar en memoria
    // COMPATIBILIDAD: Mismo formato de respuesta, mismo DTO, solo optimización interna
    
    const { Op } = require('sequelize');
    
    // Estrategia: Obtener pacientes y luego hacer una sola query para todas las últimas derivaciones
    // usando subquery con ROW_NUMBER o simplemente agrupando por patientId
    const patients = await Patient.findAll({
      where: { active: true },
      order: [['createdAt', 'DESC']],
      // Removemos separate: true para evitar N+1
      // En su lugar, haremos una query separada pero única para todas las derivaciones
    });

    // Obtener IDs de pacientes
    const patientIds = patients.map(p => p.id);
    
    // Una sola query para obtener la última derivación de cada paciente
    // Usamos subquery con ROW_NUMBER o simplemente agrupamos por patientId
    let lastDerivationsMap = {};
    if (patientIds.length > 0) {
      // Query optimizada: obtener la última derivación por patientId en una sola query
      const lastDerivations = await Derivation.findAll({
        where: {
          patientId: { [Op.in]: patientIds },
        },
        attributes: ['patientId', 'textNote', 'audioNote', 'createdAt'],
        // Usar subquery para obtener solo la última por paciente
        // Sequelize no soporta ROW_NUMBER directamente, así que usamos una estrategia alternativa:
        // Agrupar por patientId y tomar MAX(createdAt), luego hacer otra query
        // O mejor: usar raw query con ROW_NUMBER
        raw: true,
      });

      // Agrupar por patientId y tomar la más reciente
      for (const der of lastDerivations) {
        const pid = String(der.patientId);
        if (!lastDerivationsMap[pid] || 
            new Date(der.createdAt) > new Date(lastDerivationsMap[pid].createdAt)) {
          lastDerivationsMap[pid] = der;
        }
      }
    }

    // Obtener StatusRequests aprobadas de baja para construir dischargeRequest
    let dischargeMap = {};
    if (patientIds.length > 0) {
      const dischargeRequests = await StatusRequest.findAll({
        where: {
          patientId: { [Op.in]: patientIds },
          status: 'approved',
          requestedStatus: 'inactive',
          type: { [Op.ne]: 'activation' }
        },
        attributes: ['patientId', 'createdAt', 'reason', 'professionalName'],
        raw: true
      });

      // Crear mapa: patientId -> dischargeRequest más reciente
      for (const sr of dischargeRequests) {
        const pid = String(sr.patientId);
        const srDate = new Date(sr.createdAt).getTime();
        
        // Convertir createdAt a ISO string para el DTO
        let requestDate;
        if (sr.createdAt instanceof Date) {
          requestDate = sr.createdAt.toISOString();
        } else if (typeof sr.createdAt === 'string') {
          requestDate = sr.createdAt;
        } else {
          requestDate = new Date(sr.createdAt).toISOString();
        }
        
        // Si no existe o esta es más reciente, actualizar
        const existingDate = dischargeMap[pid] ? new Date(dischargeMap[pid].requestDate).getTime() : 0;
        if (!dischargeMap[pid] || srDate > existingDate) {
          dischargeMap[pid] = {
            requestedBy: sr.professionalName || 'Sistema',
            requestDate: requestDate,
            reason: sr.reason || '',
            status: 'approved'
          };
        }
      }
    }

    // Obtener StatusRequests aprobadas de activación para construir activationRequest
    let activationMap = {};
    if (patientIds.length > 0) {
      const activationRequests = await StatusRequest.findAll({
        where: {
          patientId: { [Op.in]: patientIds },
          status: 'approved',
          type: 'activation',
          requestedStatus: 'active'
        },
        attributes: ['patientId', 'createdAt', 'reason', 'professionalName'],
        raw: true
      });

      // Crear mapa: patientId -> activationRequest más reciente
      for (const sr of activationRequests) {
        const pid = String(sr.patientId);
        const srDate = new Date(sr.createdAt).getTime();
        
        // Convertir createdAt a ISO string para el DTO
        let requestDate;
        if (sr.createdAt instanceof Date) {
          requestDate = sr.createdAt.toISOString();
        } else if (typeof sr.createdAt === 'string') {
          requestDate = sr.createdAt;
        } else {
          requestDate = new Date(sr.createdAt).toISOString();
        }
        
        // Si no existe o esta es más reciente, actualizar
        const existingDate = activationMap[pid] ? new Date(activationMap[pid].requestDate).getTime() : 0;
        if (!activationMap[pid] || srDate > existingDate) {
          activationMap[pid] = {
            requestedBy: sr.professionalName || 'Sistema',
            requestDate: requestDate,
            reason: sr.reason || '',
            status: 'approved'
          };
        }
      }
    }

    // Enriquecer pacientes con última derivación, dischargeRequest y activationRequest
    const dtos = patients.map((p) => {
      const plain = p.get({ plain: true });
      const lastDer = lastDerivationsMap[String(p.id)] || {};
      const enriched = {
        ...plain,
        textNote: lastDer.textNote,
        audioNote: lastDer.audioNote,
        dischargeRequest: dischargeMap[String(p.id)] || undefined,
        activationRequest: activationMap[String(p.id)] || undefined
      };
      
      return toPatientDTO(enriched);
    });

    return sendSuccess(res, { patients: dtos });
  } catch (err) {
    logger.error('Error al obtener pacientes:', err);
    return sendError(res, 500, 'Error al obtener pacientes');
  }
}

// GET /patients/professional/:professionalId
async function getProfessionalPatients(req, res) {
  try {
    const { professionalId } = req.params;

    const patients = await Patient.findAll({
      where: { professionalId },
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: Derivation,
          as: 'derivations',
          attributes: ['textNote', 'audioNote', 'createdAt'],
          separate: true,
          limit: 1,
          order: [['createdAt', 'DESC']],
        },
      ],
    });

    const dtos = patients.map((p) => {
      const plain = p.get({ plain: true });
      const lastDer = plain.derivations?.[0] || {};
      const enriched = {
        ...plain,
        textNote: lastDer.textNote,
        audioNote: lastDer.audioNote,
      };
      return toPatientDTO(enriched);
    });

    return sendSuccess(res, { patients: dtos });
  } catch (err) {
    logger.error('Error al obtener pacientes del profesional:', err);
    return sendError(res, 500, 'Error al obtener pacientes');
  }
}


async function assignPatient(req, res) {
  try {
    const { patientId } = req.params;
    const {
      professionalId,
      professionalName,
      status,
      assignedAt,
      textNote,
      audioNote,
      sessionFrequency,
      statusChangeReason,
    } = req.body;

    const patient = await Patient.findByPk(patientId);
    if (!patient) return sendError(res, 404, 'Paciente no encontrado');

    // Guardar el professionalId original para comparar después
    const originalProfessionalId = patient.professionalId;

    // Actualiza campos del paciente
    if (professionalId !== undefined) patient.professionalId = professionalId;

    if (professionalName !== undefined) {
      patient.professionalName = professionalName;
    } else if (professionalId && !patient.professionalName) {
      const prof = await User.findByPk(professionalId, { attributes: ['name'] });
      patient.professionalName = prof?.name || null;
    }

    if (status !== undefined) patient.status = status;
    
    // Setear assignedAt: si viene en el body, usarlo; si no, setearlo automáticamente cuando se asigna un profesional
    if (assignedAt !== undefined) {
      patient.assignedAt = new Date(assignedAt);
    } else if (professionalId !== undefined && professionalId !== null) {
      // Si se está asignando un profesional
      if (!patient.assignedAt) {
        // Si el paciente no tiene assignedAt, setearlo ahora
        patient.assignedAt = new Date();
      } else if (originalProfessionalId !== professionalId) {
        // Si se está cambiando de profesional, actualizar la fecha de asignación
        patient.assignedAt = new Date();
      }
    }
    
    if (sessionFrequency !== undefined) patient.sessionFrequency = sessionFrequency;

    await patient.save();

    // Registrar derivación
    const derivation = await Derivation.create({
      patientId: patient.id,
      professionalId: professionalId ?? patient.professionalId ?? null,
      textNote: textNote ?? null,
      audioNote: audioNote ?? null,
      sessionFrequency: sessionFrequency ?? patient.sessionFrequency ?? null,
      statusChangeReason: statusChangeReason ?? null,
    });

    // Actividad
    await createActivity(
      'PATIENT_ASSIGNED',
      'Paciente asignado',
      `Paciente ${patient.name} derivado al profesional ${patient.professionalName ?? professionalId}`,
      {
        patientId: String(patient.id),
        patientName: patient.name,
        professionalId: professionalId ? String(professionalId) : undefined,
        professionalName: patient.professionalName ?? undefined,
        sessionFrequency: patient.sessionFrequency ?? undefined,
      }
    );

    // Respuesta → DTO enriquecido con la última derivación
    const plain = patient.get({ plain: true });
    const enriched = {
      ...plain,
      textNote: derivation.textNote,
      audioNote: derivation.audioNote,
    };
    return sendSuccess(res, toPatientDTO(enriched), 'Paciente asignado correctamente');
  } catch (err) {
    logger.error('Error al asignar paciente:', err);
    return sendError(res, 500, 'Error al asignar paciente');
  }
}

// POST /patients
async function addPatient(req, res) {
  try {
    const { name, description, email, phone, status, assignedAt, sessionFrequency } = req.body;

    if (!name) return sendError(res, 400, 'El nombre es requerido');

    const patient = await Patient.create({
      name,
      description: description ?? null,
      email: email ?? null,
      phone: phone ?? null,
      status: status ?? 'pending',
      assignedAt: assignedAt ? new Date(assignedAt) : null,
      sessionFrequency: sessionFrequency ?? null,
      active: true,
    });

    return sendSuccess(res, toPatientDTO(patient), 'Paciente creado correctamente', 201);
  } catch (err) {
    logger.error('Error al agregar paciente:', err);
    return sendError(res, 500, 'Error al agregar paciente');
  }
}


// DELETE /patients/:id
async function deletePatient(req, res) {
  try {
    const { id } = req.params;
    const patient = await Patient.findByPk(id);
    if (!patient || !patient.active) {
      return sendError(res, 404, 'Paciente no encontrado');
    }

    patient.active = false;
    await patient.save();

    await createActivity(
      'PATIENT_SOFT_DELETED',
      'Paciente deshabilitado',
      `Se deshabilitó al paciente ${patient.name}`,
      { patientId: String(patient.id), patientName: patient.name }
    );

    return sendSuccess(res, null, 'Paciente eliminado correctamente', 204);
  } catch (err) {
    logger.error('Error al eliminar paciente:', err);
    return sendError(res, 500, 'Error al eliminar paciente');
  }
}


// Solicitar dar de baja a un paciente
// POST /patients/:patientId/request-discharge
async function requestDischargePatient(req, res) {
  try {
    const { patientId } = req.params;
    const { reason } = req.body;
    const { id: professionalId, name: professionalName } = req.user;

    const patient = await Patient.findByPk(patientId);
    if (!patient) return sendError(res, 404, 'Paciente no encontrado');

    // ¿Solicitud pendiente para este paciente?
    const pending = await StatusRequest.findOne({
      where: { patientId, status: 'pending' },
    });
    if (pending) {
      return sendError(res, 400, 'Ya existe una solicitud pendiente para este paciente');
    }

    const sr = await StatusRequest.create({
      patientId,
      patientName: patient.name,
      professionalId,
      professionalName,
      currentStatus: patient.status,
      requestedStatus: 'inactive',
      reason: reason ?? '',
      status: 'pending',
    });

    await createActivity(
      'PATIENT_DISCHARGE_REQUEST',
      'Solicitud de baja de paciente',
      `El profesional ${professionalName} ha solicitado dar de baja al paciente ${patient.name}`,
      {
        patientId: String(patient.id),
        patientName: patient.name,
        professionalId: String(professionalId),
        professionalName,
        reason: reason ?? '',
      }
    );

    return sendSuccess(res, { requestId: String(sr.id) }, 'Solicitud de baja enviada correctamente', 201);
  } catch (error) {
    logger.error('Error requesting patient discharge:', error);
    return sendError(res, 500, 'Error al solicitar la baja del paciente');
  }
}



// Solicitar activación de un paciente
async function requestActivationPatient(req, res) {
  try {
    const { patientId } = req.params;
    const { reason } = req.body;
    const { id: professionalId, name: professionalName } = req.user;

    const patient = await Patient.findByPk(patientId);
    if (!patient) {
      return sendError(res, 404, 'Paciente no encontrado');
    }

    // Validar que el paciente esté inactive
    if (patient.status !== 'inactive') {
      return sendError(res, 400, 'Solo se puede solicitar la activación de pacientes inactivos');
    }

    // 1) Ya existe solicitud de activación pendiente para este paciente
    const existingActivation = await StatusRequest.findOne({
      where: { 
        patientId, 
        status: 'pending', 
        type: 'activation',
        requestedStatus: 'active'
      },
    });
    if (existingActivation) {
      return sendError(res, 400, 'Ya existe una solicitud de activación pendiente para este paciente');
    }

    // 4) Crear la solicitud en BD
    await StatusRequest.create({
      patientId,
      patientName: patient.name,            // snapshot
      professionalId,
      professionalName,                     // snapshot
      currentStatus: patient.status,
      requestedStatus: 'active',            // activación del paciente
      reason,
      status: 'pending',
      type: 'activation',                   // tipo de solicitud: activación
    });

    // 5) Crear actividad para el feed
    await createActivity(
      'PATIENT_ACTIVATION_REQUEST',
      'Solicitud de activación de paciente',
      `El profesional ${professionalName} ha solicitado activar al paciente ${patient.name}`,
      {
        patientId: String(patient.id),
        patientName: patient.name,
        professionalId: String(professionalId),
        professionalName,
        currentStatus: patient.status,
        requestedStatus: 'active',
        reason,
        status: 'pending',
      }
    );

    return sendSuccess(res, null, 'Solicitud de activación enviada correctamente', 201);
  } catch (error) {
    logger.error('Error requesting patient activation:', error);
    return sendError(res, 500, 'Error al solicitar la activación del paciente');
  }
}

module.exports = {
	getAllPatients,
	getProfessionalPatients,
	assignPatient,
	addPatient,
	deletePatient,
	requestDischargePatient,
	requestActivationPatient,
};
