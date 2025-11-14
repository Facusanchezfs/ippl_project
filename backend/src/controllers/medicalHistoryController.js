'use strict';
const { MedicalHistory, Patient } = require('../../models');
const {
  toMedicalHistoryDTO,
  toMedicalHistoryDTOList,
} = require('../../mappers/MedicalHistoryMapper');
const logger = require('../utils/logger');

// Lista historiales filtrando por patientId o professionalId (vía params o query).
// Respuesta: { histories: MedicalHistoryDTO[] }
async function getMedicalHistories(req, res) {
  try {
    // Permite ambos orígenes
    const patientId =
      req.params.patientId ?? req.query.patientId ?? undefined;

    const professionalId =
      req.params.professionalId ?? req.query.professionalId ?? undefined;

    if (!patientId && !professionalId) {
      return res.status(400).json({
        message: 'Debe proporcionar patientId o professionalId (params o query)',
      });
    }

    const where = {};
    if (patientId) where.patientId = patientId;
    if (professionalId) where.professionalId = professionalId;

    const histories = await MedicalHistory.findAll({
      where,
      order: [
        ['date', 'DESC'],
        ['createdAt', 'DESC'],
      ],
    });

    return res.json(toMedicalHistoryDTOList(histories));
  } catch (error) {
    logger.error('[getMedicalHistories] Error:', error);
    return res.status(500).json({ message: 'Error al obtener historiales médicos' });
  }
}


async function getMedicalHistoryById(req, res) {
  try {
    const { id } = req.params;
    const mh = await MedicalHistory.findByPk(id);
    if (!mh) {
      return res.status(404).json({ message: 'Historial médico no encontrado' });
    }
    return res.json(toMedicalHistoryDTO(mh));
  } catch (error) {
    logger.error('[getMedicalHistoryById] Error:', error);
    return res.status(500).json({ message: 'Error al obtener historial médico' });
  }
}

async function createMedicalHistory(req, res) {
  try {
    const { patientId, date, diagnosis, treatment, notes } = req.body;

    // Validaciones básicas
    if (!patientId || !date || !diagnosis || !treatment || !notes) {
      return res.status(400).json({ message: 'Faltan campos requeridos' });
    }

    // Verificar que el paciente exista
    const patient = await Patient.findByPk(patientId, { attributes: ['id'] });
    if (!patient) {
      return res.status(404).json({ message: 'Paciente no encontrado' });
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

    return res.status(201).json(toMedicalHistoryDTO(created));
  } catch (error) {
    logger.error('[createMedicalHistory] Error:', error);
    return res.status(500).json({ message: 'Error al crear historial médico' });
  }
}


// Actualiza diagnosis/treatment/notes (UpdateMedicalHistoryDto)
async function updateMedicalHistory(req, res) {
  try {
    const { id } = req.params;
    const { diagnosis, treatment, notes } = req.body;

    const mh = await MedicalHistory.findByPk(id);
    if (!mh) {
      return res.status(404).json({ message: 'Historial médico no encontrado' });
    }

    // Autorización simple: autor (professionalId) o admin
    const isAdmin = req.user?.role === 'admin';
    const isAuthor = req.user && String(req.user.id) === String(mh.professionalId ?? '');
    if (!isAdmin && !isAuthor) {
      return res.status(403).json({ message: 'No autorizado para editar este historial' });
    }

    const updates = {};
    if (diagnosis !== undefined) updates.diagnosis = diagnosis;
    if (treatment !== undefined) updates.treatment = treatment;
    if (notes !== undefined) updates.notes = notes;

    await mh.update(updates);
    await mh.reload();

    return res.json(toMedicalHistoryDTO(mh));
  } catch (error) {
    logger.error('[updateMedicalHistory] Error:', error);
    return res.status(500).json({ message: 'Error al actualizar historial médico' });
  }
}


const deleteMedicalHistory = async (req, res) => {
  try {
    const historyId = req.params.id;
    
    const data = await fs.readFile(MEDICAL_HISTORY_FILE, 'utf8');
    const histories = JSON.parse(data);
    
    const filteredHistories = histories.filter(h => h.id !== historyId);
    
    if (filteredHistories.length === histories.length) {
      return res.status(404).json({ message: 'Historial médico no encontrado' });
    }
    
    await fs.writeFile(MEDICAL_HISTORY_FILE, JSON.stringify(filteredHistories, null, 2));
    
    res.json({ message: 'Historial médico eliminado correctamente' });
  } catch (error) {
    logger.error('Error al eliminar el historial médico:', error);
    res.status(500).json({ message: 'Error al eliminar el historial médico' });
  }
};

module.exports = {
  getMedicalHistories,
  getMedicalHistoryById,
  createMedicalHistory,
  updateMedicalHistory,
  deleteMedicalHistory
}; 