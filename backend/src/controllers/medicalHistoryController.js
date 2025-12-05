'use strict';
const { MedicalHistory, Patient } = require('../../models');
const {
  toMedicalHistoryDTO,
  toMedicalHistoryDTOList,
} = require('../../mappers/MedicalHistoryMapper');
const logger = require('../utils/logger');
const { sendSuccess, sendError } = require('../utils/response');

// Lista historiales filtrando por patientId o professionalId (vía params o query).
// Respuesta: { histories: MedicalHistoryDTO[] }
async function getMedicalHistories(req, res) {
  try {
    // Permite ambos orígenes
    const patientIdParam =
      req.params.patientId ?? req.query.patientId ?? undefined;

    const professionalIdParam =
      req.params.professionalId ?? req.query.professionalId ?? undefined;

    if (!patientIdParam && !professionalIdParam) {
      return sendError(res, 400, 'Debe proporcionar patientId o professionalId (params o query)');
    }

    // Convertir strings a números si es necesario
    const patientId = patientIdParam ? parseInt(patientIdParam, 10) : undefined;
    const professionalId = professionalIdParam ? parseInt(professionalIdParam, 10) : undefined;

    const where = {};
    if (patientId) {
      // Verificar que el paciente existe y está activo
      const patient = await Patient.findByPk(patientId, { attributes: ['id', 'active'] });
      if (!patient || !patient.active) {
        return sendError(res, 404, 'Paciente no encontrado');
      }
      where.patientId = patientId;
    }
    if (professionalId) where.professionalId = professionalId;

    const histories = await MedicalHistory.findAll({
      where,
      order: [
        ['date', 'DESC'],
        ['createdAt', 'DESC'],
      ],
    });

    return sendSuccess(res, toMedicalHistoryDTOList(histories));
  } catch (error) {
    logger.error('[getMedicalHistories] Error:', error);
    return sendError(res, 500, 'Error al obtener historiales médicos');
  }
}


async function getMedicalHistoryById(req, res) {
  try {
    const { id } = req.params;
    const mh = await MedicalHistory.findByPk(id);
    if (!mh) {
      return sendError(res, 404, 'Historial médico no encontrado');
    }
    return sendSuccess(res, toMedicalHistoryDTO(mh));
  } catch (error) {
    logger.error('[getMedicalHistoryById] Error:', error);
    return sendError(res, 500, 'Error al obtener historial médico');
  }
}

async function createMedicalHistory(req, res) {
  try {
    const { patientId: patientIdParam, date, diagnosis, treatment, notes } = req.body;

    // Validaciones básicas (notes es opcional)
    if (!patientIdParam || !date || !diagnosis || !treatment) {
      return sendError(res, 400, 'Faltan campos requeridos');
    }

    // Convertir patientId a número si es necesario
    const patientId = typeof patientIdParam === 'string' ? parseInt(patientIdParam, 10) : patientIdParam;

    // Verificar que el paciente exista y esté activo
    const patient = await Patient.findByPk(patientId, { attributes: ['id', 'active'] });
    if (!patient || !patient.active) {
      return sendError(res, 404, 'Paciente no encontrado');
    }

    // Profesional (si estás autenticando, suele venir en req.user)
    const professionalId = req.user?.id ?? null;

    const created = await MedicalHistory.create({
      patientId,
      professionalId,
      date,        // YYYY-MM-DD (DATEONLY)
      diagnosis,
      treatment,
      notes,
    });

    return sendSuccess(res, toMedicalHistoryDTO(created), 'Historial médico creado correctamente', 201);
  } catch (error) {
    logger.error('[createMedicalHistory] Error:', error);
    return sendError(res, 500, 'Error al crear historial médico');
  }
}


// Actualiza diagnosis/treatment/notes (UpdateMedicalHistoryDto)
async function updateMedicalHistory(req, res) {
  try {
    const { id } = req.params;
    const { diagnosis, treatment, notes } = req.body;

    const mh = await MedicalHistory.findByPk(id);
    if (!mh) {
      return sendError(res, 404, 'Historial médico no encontrado');
    }

    // Autorización simple: autor (professionalId) o admin
    const isAdmin = req.user?.role === 'admin';
    const isAuthor = req.user && String(req.user.id) === String(mh.professionalId ?? '');
    if (!isAdmin && !isAuthor) {
      return sendError(res, 403, 'No autorizado para editar este historial');
    }

    const updates = {};
    if (diagnosis !== undefined) updates.diagnosis = diagnosis;
    if (treatment !== undefined) updates.treatment = treatment;
    if (notes !== undefined) updates.notes = notes;

    await mh.update(updates);
    await mh.reload();

    return sendSuccess(res, toMedicalHistoryDTO(mh), 'Historial médico actualizado correctamente');
  } catch (error) {
    logger.error('[updateMedicalHistory] Error:', error);
    return sendError(res, 500, 'Error al actualizar historial médico');
  }
}


const deleteMedicalHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const mh = await MedicalHistory.findByPk(id);
    
    if (!mh) {
      return sendError(res, 404, 'Historial médico no encontrado');
    }
    
    await mh.destroy();
    
    return sendSuccess(res, null, 'Historial médico eliminado correctamente', 204);
  } catch (error) {
    logger.error('Error al eliminar el historial médico:', error);
    return sendError(res, 500, 'Error al eliminar el historial médico');
  }
};

module.exports = {
  getMedicalHistories,
  getMedicalHistoryById,
  createMedicalHistory,
  updateMedicalHistory,
  deleteMedicalHistory
}; 