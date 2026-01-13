'use strict';
const { Patient, Derivation, User, StatusRequest } = require('../../models');
const { toPatientDTO } = require('../../mappers/PatientMapper');
const { createActivity } = require('./activityController');
const logger = require('../utils/logger');
const { sendSuccess, sendError } = require('../utils/response');

async function getAllPatients(req, res) {
  try {
    const { Op } = require('sequelize');
    
    const patients = await Patient.findAll({
      where: { active: true },
      order: [['createdAt', 'DESC']],
    });

    const patientIds = patients.map(p => p.id);
    
    let lastDerivationsMap = {};
    if (patientIds.length > 0) {
      const lastDerivations = await Derivation.findAll({
        where: {
          patientId: { [Op.in]: patientIds },
        },
        attributes: ['patientId', 'textNote', 'audioNote', 'createdAt'],
        raw: true,
      });

      for (const der of lastDerivations) {
        const pid = String(der.patientId);
        if (!lastDerivationsMap[pid] || 
            new Date(der.createdAt) > new Date(lastDerivationsMap[pid].createdAt)) {
          lastDerivationsMap[pid] = der;
        }
      }
    }

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

      for (const sr of dischargeRequests) {
        const pid = String(sr.patientId);
        const srDate = new Date(sr.createdAt).getTime();
        
        let requestDate;
        if (sr.createdAt instanceof Date) {
          requestDate = sr.createdAt.toISOString();
        } else if (typeof sr.createdAt === 'string') {
          requestDate = sr.createdAt;
        } else {
          requestDate = new Date(sr.createdAt).toISOString();
        }
        
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

      for (const sr of activationRequests) {
        const pid = String(sr.patientId);
        const srDate = new Date(sr.createdAt).getTime();
        
        let requestDate;
        if (sr.createdAt instanceof Date) {
          requestDate = sr.createdAt.toISOString();
        } else if (typeof sr.createdAt === 'string') {
          requestDate = sr.createdAt;
        } else {
          requestDate = new Date(sr.createdAt).toISOString();
        }
        
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

async function getProfessionalPatients(req, res) {
  try {
    const { professionalId } = req.params;

    const patients = await Patient.findAll({
      where: { professionalId, active: true },
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
    if (!patient || !patient.active) return sendError(res, 404, 'Paciente no encontrado');

    const originalProfessionalId = patient.professionalId;

    if (professionalId !== undefined) patient.professionalId = professionalId;

    if (professionalName !== undefined) {
      patient.professionalName = professionalName;
    } else if (professionalId && !patient.professionalName) {
      const prof = await User.findByPk(professionalId, { attributes: ['name'] });
      patient.professionalName = prof?.name || null;
    }

    if (status !== undefined) patient.status = status;
    
    if (assignedAt !== undefined) {
      patient.assignedAt = new Date(assignedAt);
    } else if (professionalId !== undefined && professionalId !== null) {
      if (!patient.assignedAt) {
        patient.assignedAt = new Date();
      } else if (originalProfessionalId !== professionalId) {
        patient.assignedAt = new Date();
      }
    }
    
    if (sessionFrequency !== undefined) patient.sessionFrequency = sessionFrequency;

    await patient.save();

    const lastDerivation = await Derivation.findOne({
      where: { patientId: patient.id },
      order: [['createdAt', 'DESC']],
      attributes: ['textNote', 'audioNote'],
    });

    let finalTextNote, finalAudioNote;

    if (textNote !== undefined && audioNote !== undefined) {
      finalTextNote = textNote;
      finalAudioNote = audioNote;
    } 
    else if (textNote !== undefined) {
      finalTextNote = textNote;
      finalAudioNote = null;
    } 
    else if (audioNote !== undefined) {
      finalTextNote = null;
      finalAudioNote = audioNote;
    } 
    else {
      finalTextNote = lastDerivation?.textNote ?? null;
      finalAudioNote = lastDerivation?.audioNote ?? null;
    }

    const derivation = await Derivation.create({
      patientId: patient.id,
      professionalId: professionalId ?? patient.professionalId ?? null,
      textNote: finalTextNote,
      audioNote: finalAudioNote,
      sessionFrequency: sessionFrequency ?? patient.sessionFrequency ?? null,
      statusChangeReason: statusChangeReason ?? null,
    });

    const newProfessionalId = professionalId ?? patient.professionalId;
    const professionalIdChanged = newProfessionalId && 
                                  String(newProfessionalId) !== String(originalProfessionalId);
    
    if (professionalIdChanged && newProfessionalId) {
      await createActivity(
        'PATIENT_ASSIGNED',
        'Paciente asignado',
        `Paciente ${patient.name} derivado al profesional ${patient.professionalName || newProfessionalId}`,
        {
          patientId: String(patient.id),
          patientName: patient.name,
          professionalId: String(newProfessionalId),
          professionalName: patient.professionalName || undefined,
          sessionFrequency: patient.sessionFrequency || undefined,
        }
      );
    }

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


async function requestDischargePatient(req, res) {
  try {
    const { patientId } = req.params;
    const { reason } = req.body;
    const { id: professionalId, name: professionalName } = req.user;

    const patient = await Patient.findByPk(patientId);
    if (!patient || !patient.active) return sendError(res, 404, 'Paciente no encontrado');

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



async function requestActivationPatient(req, res) {
  try {
    const { patientId } = req.params;
    const { reason } = req.body;
    const { id: professionalId, name: professionalName } = req.user;

    const patient = await Patient.findByPk(patientId);
    if (!patient || !patient.active) {
      return sendError(res, 404, 'Paciente no encontrado');
    }

    if (patient.status !== 'inactive') {
      return sendError(res, 400, 'Solo se puede solicitar la activación de pacientes inactivos');
    }

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

    await StatusRequest.create({
      patientId,
      patientName: patient.name,
      professionalId,
      professionalName,
      currentStatus: patient.status,
      requestedStatus: 'active',
      reason,
      status: 'pending',
      type: 'activation',
    });

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
