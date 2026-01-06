const { Op } = require('sequelize');
const { Activity, User } = require('../../models');
const { toActivityDTO, toActivityDTOList } = require('../../mappers/ActivityMapper');
const logger = require('../utils/logger');
const { sendSuccess, sendError } = require('../utils/response');

async function createActivity(type, title, description, metadata = {}) {
  try {
    const patientId = metadata?.patientId ?? null;
    const professionalId = metadata?.professionalId ?? null;

    let normalizedTitle = title;
    let normalizedDescription = description;

    if (type.startsWith('FREQUENCY_CHANGE')) {
      const humanFrequency = (freq) => {
        switch (freq) {
          case 'weekly':
            return 'Semanal';
          case 'biweekly':
            return 'Quincenal';
          case 'monthly':
            return 'Mensual';
          default:
            return freq;
        }
      };

      normalizedTitle = 'Solicitud de cambio de frecuencia';

      const professionalName = metadata.professionalName || 'Un profesional';
      const patientName = metadata.patientName || 'un paciente';
      const currentFrequency = humanFrequency(metadata.currentFrequency);
      const requestedFrequency = humanFrequency(metadata.requestedFrequency || metadata.newFrequency);

      normalizedDescription = `${professionalName} solicitó cambiar la frecuencia de sesiones de ${patientName} de ${currentFrequency} a ${requestedFrequency}`;
    }

    const created = await Activity.create({
      type,
      title: normalizedTitle,
      description: normalizedDescription,
      metadata,
      occurredAt: new Date(),
      patientId,
      professionalId,
    });

    return toActivityDTO(created);
  } catch (error) {
    logger.error('Error creating activity:', error);
    throw error;
  }
}

function normalizeMetadata(metadata) {
  if (!metadata) return null;
  
  if (typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata;
  }
  
  if (typeof metadata === 'string') {
    try {
      const parsed = JSON.parse(metadata);
      return typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch (e) {
      logger.warn('Error parsing metadata as JSON:', e);
      return null;
    }
  }
  
  return null;
}

async function getActivities(req, res) {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    
    if (!userId || !userRole) {
      return sendError(res, 401, 'Usuario no autenticado');
    }

    const relevantTypes = [
      'PATIENT_DISCHARGE_REQUEST',
      'PATIENT_ACTIVATION_REQUEST',
      'PATIENT_ASSIGNED',
      'PATIENT_ACTIVATION_APPROVED',
      'STATUS_CHANGE_APPROVED',
      'STATUS_CHANGE_REJECTED',
      'FREQUENCY_CHANGE_REQUEST',
      'FREQUENCY_CHANGE_REQUESTED',
      'FREQUENCY_CHANGE_APPROVED',
      'FREQUENCY_CHANGE_REJECTED'
    ];

    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    
    if (page < 1) return sendError(res, 400, 'page debe ser mayor a 0');
    if (limit < 1) return sendError(res, 400, 'limit debe ser mayor a 0');
    
    const offset = (page - 1) * limit;

    const whereConditions = {
      type: relevantTypes,
    };

    if (userRole === 'professional') {
      whereConditions.professionalId = userId;
    } else {
      whereConditions.professionalId = {
        [Op.ne]: null
      };
    }

    const includeConditions = [{
      model: User,
      as: 'professional',
      required: true,
      attributes: ['id'],
    }];

    const { count, rows: activities } = await Activity.findAndCountAll({
      where: whereConditions,
      include: includeConditions,
      order: [['occurredAt', 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    const normalizedActivities = activities.map(activity => {
      const plain = activity.get({ plain: true });
      if (plain.metadata) {
        plain.metadata = normalizeMetadata(plain.metadata);
      }
      return plain;
    });

    const totalPages = Math.ceil(count / limit);

    const hasPagination = req.query.page !== undefined || req.query.limit !== undefined;
    
    if (hasPagination) {
      return sendSuccess(res, {
        activities: toActivityDTOList(normalizedActivities),
        pagination: {
          page,
          limit,
          total: count,
          totalPages,
        },
      });
    } else {
      return sendSuccess(res, toActivityDTOList(normalizedActivities));
    }
  } catch (error) {
    logger.error('Error getting activities:', error);
    return sendError(res, 500, 'Error al obtener las actividades');
  }
}

async function markAsRead(req, res) {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    
    if (!userId || !userRole) {
      return sendError(res, 401, 'Usuario no autenticado');
    }

    const { id } = req.params;
    const activity = await Activity.findByPk(id, {
      include: [{
        model: User,
        as: 'professional',
        required: true,
        attributes: ['id'],
      }],
    });
    
    if (!activity) return sendError(res, 404, 'Actividad no encontrada');

    if (userRole === 'professional') {
      if (String(activity.professionalId) !== String(userId)) {
        return sendError(res, 403, 'No tienes permiso para marcar esta actividad como leída');
      }
    }

    if (!activity.read) await activity.update({ read: true });
    return sendSuccess(res, null, 'Actividad marcada como leída', 204);
  } catch (error) {
    logger.error('Error marking activity as read:', error);
    return sendError(res, 500, 'Error al marcar la actividad como leída');
  }
}

async function markAllAsRead(req, res) {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    
    if (!userId || !userRole) {
      return sendError(res, 401, 'Usuario no autenticado');
    }

    const whereConditions = { read: false };
    
    if (userRole === 'professional') {
      whereConditions.professionalId = userId;
    } else {
      whereConditions.professionalId = {
        [Op.ne]: null
      };
    }

    await Activity.update({ read: true }, { where: whereConditions });
    return sendSuccess(res, null, 'Todas las actividades marcadas como leídas', 204);
  } catch (error) {
    logger.error('Error marking all activities as read:', error);
    return sendError(res, 500, 'Error al marcar todas las actividades como leídas');
  }
}

async function getUnreadCount(req, res) {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    
    if (!userId || !userRole) {
      return sendError(res, 401, 'Usuario no autenticado');
    }

    const whereConditions = { read: false };
    
    if (userRole === 'professional') {
      whereConditions.professionalId = userId;
    } else {
      whereConditions.professionalId = {
        [Op.ne]: null
      };
    }

    const includeConditions = [{
      model: User,
      as: 'professional',
      required: true,
      attributes: ['id'],
    }];

    const count = await Activity.count({
      where: whereConditions,
      include: includeConditions,
      distinct: true,
    });
    
    return sendSuccess(res, { count });
  } catch (error) {
    logger.error('Error getting unread count:', error);
    return sendError(res, 500, 'Error al obtener el conteo de actividades no leídas');
  }
}

async function clearAllActivities(req, res) {
  try {
    await Activity.destroy({ where: {} });
    return sendSuccess(res, null, 'Todas las actividades han sido eliminadas', 204);
  } catch (error) {
    logger.error('Error clearing activities:', error);
    return sendError(res, 500, 'Error al limpiar las actividades');
  }
}


module.exports = {
  createActivity,
  getActivities,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  clearAllActivities
}; 