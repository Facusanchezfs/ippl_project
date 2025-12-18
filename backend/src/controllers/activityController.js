const { Op } = require('sequelize');
const { Activity, User } = require('../../models');
const { toActivityDTO, toActivityDTOList } = require('../../mappers/ActivityMapper');
const logger = require('../utils/logger');
const { sendSuccess, sendError } = require('../utils/response');

// Crear una nueva actividad
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

// Función helper para normalizar metadata (puede estar serializado como string)
function normalizeMetadata(metadata) {
  if (!metadata) return null;
  
  // Si ya es un objeto, retornarlo
  if (typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata;
  }
  
  // Si es string, intentar parsearlo
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

// Obtener todas las actividades
async function getActivities(req, res) {
  try {
    // Obtener información del usuario autenticado
    const userId = req.user?.id;
    const userRole = req.user?.role;
    
    if (!userId || !userRole) {
      return sendError(res, 401, 'Usuario no autenticado');
    }

    // OPTIMIZACIÓN FASE 3 PARTE 2: getActivities
    // PROBLEMA: Sin paginación, trae miles de registros innecesarios.
    // IMPACTO: Con muchas actividades = transferencia masiva, lento, alto uso de memoria.
    // SOLUCIÓN: Paginación con límite máximo (max 100) + índice compuesto (type, occurredAt DESC).
    // COMPATIBILIDAD: Formato de respuesta con paginación estándar, mantiene DTO.
    
    // Incluyo ambos sufijos por compatibilidad: REQUEST vs REQUESTED
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
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100); // Máximo 100
    
    if (page < 1) return sendError(res, 400, 'page debe ser mayor a 0');
    if (limit < 1) return sendError(res, 400, 'limit debe ser mayor a 0');
    
    const offset = (page - 1) * limit;

    // Construir condiciones WHERE
    const whereConditions = {
      type: relevantTypes,
    };

    // REGLA DE NEGOCIO: Filtrar por professionalId según el rol
    if (userRole === 'professional') {
      // Un profesional solo puede ver SUS PROPIAS activities
      whereConditions.professionalId = userId;
    } else {
      // Admin: solo mostrar activities con professionalId (no null)
      // El INNER JOIN asegurará que el profesional existe
      whereConditions.professionalId = {
        [Op.ne]: null
      };
    }

    // REGLA DE NEGOCIO: No mostrar activities de profesionales eliminados
    // Usamos un INNER JOIN con User para asegurar que el profesional existe
    const includeConditions = [{
      model: User,
      as: 'professional',
      required: true, // INNER JOIN: solo activities donde el profesional existe
      attributes: ['id'], // Solo necesitamos verificar existencia
    }];

    const { count, rows: activities } = await Activity.findAndCountAll({
      where: whereConditions,
      include: includeConditions,
      order: [['occurredAt', 'DESC']],
      limit,
      offset,
      distinct: true, // Importante para count correcto con includes
    });

    // Normalizar metadata de cada activity (puede estar serializado como string)
    const normalizedActivities = activities.map(activity => {
      const plain = activity.get({ plain: true });
      if (plain.metadata) {
        plain.metadata = normalizeMetadata(plain.metadata);
      }
      return plain;
    });

    const totalPages = Math.ceil(count / limit);

    // COMPATIBILIDAD: Si no se pasa paginación, devolver formato antiguo (array directo)
    // Si se pasa paginación, devolver formato nuevo con paginación
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
      // Formato antiguo para compatibilidad con frontend actual
      return sendSuccess(res, toActivityDTOList(normalizedActivities));
    }
  } catch (error) {
    logger.error('Error getting activities:', error);
    return sendError(res, 500, 'Error al obtener las actividades');
  }
}

// Marcar una actividad como leída
async function markAsRead(req, res) {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    
    if (!userId || !userRole) {
      return sendError(res, 401, 'Usuario no autenticado');
    }

    const { id } = req.params; // el cliente envía _id como string; acá usamos la PK "id"
    const activity = await Activity.findByPk(id, {
      include: [{
        model: User,
        as: 'professional',
        required: true, // Asegurar que el profesional existe
        attributes: ['id'],
      }],
    });
    
    if (!activity) return sendError(res, 404, 'Actividad no encontrada');

    // REGLA DE NEGOCIO: Un profesional solo puede marcar como leídas SUS PROPIAS activities
    if (userRole === 'professional') {
      if (String(activity.professionalId) !== String(userId)) {
        return sendError(res, 403, 'No tienes permiso para marcar esta actividad como leída');
      }
    }
    // Si es admin, puede marcar cualquier activity como leída

    if (!activity.read) await activity.update({ read: true });
    return sendSuccess(res, null, 'Actividad marcada como leída', 204);
  } catch (error) {
    logger.error('Error marking activity as read:', error);
    return sendError(res, 500, 'Error al marcar la actividad como leída');
  }
}

// Marcar todas las actividades como leídas
async function markAllAsRead(req, res) {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    
    if (!userId || !userRole) {
      return sendError(res, 401, 'Usuario no autenticado');
    }

    // Construir condiciones WHERE
    const whereConditions = { read: false };
    
    // REGLA DE NEGOCIO: Un profesional solo puede marcar como leídas SUS PROPIAS activities
    if (userRole === 'professional') {
      whereConditions.professionalId = userId;
    } else {
      // Admin: solo marcar activities con professionalId (no null)
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

// Obtener el conteo de actividades no leídas
async function getUnreadCount(req, res) {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    
    if (!userId || !userRole) {
      return sendError(res, 401, 'Usuario no autenticado');
    }

    // Construir condiciones WHERE
    const whereConditions = { read: false };
    
    // REGLA DE NEGOCIO: Un profesional solo cuenta SUS PROPIAS activities no leídas
    if (userRole === 'professional') {
      whereConditions.professionalId = userId;
    } else {
      // Admin: solo contar activities con professionalId (no null)
      whereConditions.professionalId = {
        [Op.ne]: null
      };
    }

    // REGLA DE NEGOCIO: No contar activities de profesionales eliminados
    // Usamos un INNER JOIN con User para asegurar que el profesional existe
    const includeConditions = [{
      model: User,
      as: 'professional',
      required: true, // INNER JOIN: solo activities donde el profesional existe
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

// Limpiar todas las actividades
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