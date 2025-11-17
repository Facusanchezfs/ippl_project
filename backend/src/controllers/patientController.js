'use strict';
const { Patient, Derivation, User, StatusRequest } = require('../../models');
const { toPatientDTO } = require('../../mappers/PatientMapper');
const { createActivity } = require('./activityController');
const logger = require('../utils/logger');
const { sendSuccess, sendError } = require('../utils/response');

// Obtener todos los pacientes con su última derivación
async function getAllPatients(req, res) {
  try {
    const patients = await Patient.findAll({
      where: { active: true },
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

    // Actualiza campos del paciente
    if (professionalId !== undefined) patient.professionalId = professionalId;

    if (professionalName !== undefined) {
      patient.professionalName = professionalName;
    } else if (professionalId && !patient.professionalName) {
      const prof = await User.findByPk(professionalId, { attributes: ['name'] });
      patient.professionalName = prof?.name || null;
    }

    if (status !== undefined) patient.status = status;
    if (assignedAt !== undefined) patient.assignedAt = new Date(assignedAt);
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



// Solicitar alta de un paciente
async function requestActivationPatient(req, res) {
  try {
    const { patientId } = req.params;
    const { reason } = req.body;
    const { id: professionalId, name: professionalName } = req.user;

    const patient = await Patient.findByPk(patientId);
    if (!patient) {
      return sendError(res, 404, 'Paciente no encontrado');
    }

    // 1) Ya existe solicitud de ALTA pendiente para este paciente
    const existingActivation = await StatusRequest.findOne({
      where: { patientId, status: 'pending', requestedStatus: 'alta' },
    });
    if (existingActivation) {
      return sendError(res, 400, 'Ya existe una solicitud de alta pendiente para este paciente');
    }

    // 4) Crear la solicitud en BD
    await StatusRequest.create({
      patientId,
      patientName: patient.name,            // snapshot
      professionalId,
      professionalName,                     // snapshot
      currentStatus: patient.status,
      requestedStatus: 'alta',              // alta médica (cierre de tratamiento)
      reason,
      status: 'pending',
    });

    // 5) Crear actividad para el feed
    await createActivity(
      'PATIENT_ACTIVATION_REQUEST',
      'Solicitud de alta de paciente',
      `El profesional ${professionalName} ha solicitado dar de alta al paciente ${patient.name}`,
      {
        patientId: String(patient.id),
        patientName: patient.name,
        professionalId: String(professionalId),
        professionalName,
        currentStatus: patient.status,
        requestedStatus: 'alta',
        reason,
        status: 'pending',
      }
    );

    return sendSuccess(res, null, 'Solicitud de alta enviada correctamente', 201);
  } catch (error) {
    logger.error('Error requesting patient activation:', error);
    return sendError(res, 500, 'Error al solicitar el alta del paciente');
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
