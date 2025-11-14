const { Activity } = require('../../models');
const { toActivityDTO, toActivityDTOList } = require('../../mappers/ActivityMapper');

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
    console.error('Error creating activity:', error);
    throw error;
  }
}

// Obtener todas las actividades
async function getActivities(req, res) {
  try {
    // Incluyo ambos sufijos por compatibilidad: REQUEST vs REQUESTED
    const relevantTypes = [
      'PATIENT_DISCHARGE_REQUEST',
      'PATIENT_ACTIVATION_REQUEST',
      'STATUS_CHANGE_APPROVED',
      'STATUS_CHANGE_REJECTED',
      'FREQUENCY_CHANGE_REQUEST',
      'FREQUENCY_CHANGE_REQUESTED',
      'FREQUENCY_CHANGE_APPROVED',
      'FREQUENCY_CHANGE_REJECTED'
    ];

    const activities = await Activity.findAll({
      where: { type: relevantTypes },
      order: [['occurredAt', 'DESC']],
    });

    res.json(toActivityDTOList(activities));
  } catch (error) {
    console.error('Error getting activities:', error);
    res.status(500).json({ error: 'Error al obtener las actividades' });
  }
}

// Marcar una actividad como leída
async function markAsRead(req, res) {
  try {
    const { id } = req.params; // el cliente envía _id como string; acá usamos la PK "id"
    const activity = await Activity.findByPk(id);
    if (!activity) return res.status(404).json({ error: 'Actividad no encontrada' });

    if (!activity.read) await activity.update({ read: true });
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking activity as read:', error);
    res.status(500).json({ error: 'Error al marcar la actividad como leída' });
  }
}

// Marcar todas las actividades como leídas
async function markAllAsRead(req, res) {
  try {
    await Activity.update({ read: true }, { where: { read: false } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all activities as read:', error);
    res.status(500).json({ error: 'Error al marcar todas las actividades como leídas' });
  }
}

// Obtener el conteo de actividades no leídas
async function getUnreadCount(req, res) {
  try {
    const count = await Activity.count({
      where: { read: false, type: { [Op.in]: CLIENT_ACTIVITY_TYPES } },
    });
    res.json({ count });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ error: 'Error al obtener el conteo de actividades no leídas' });
  }
}

// Limpiar todas las actividades
async function clearAllActivities(req, res) {
  try {
    await Activity.destroy({ where: {} });
    res.json({ success: true, message: 'Todas las actividades han sido eliminadas' });
  } catch (error) {
    console.error('Error clearing activities:', error);
    res.status(500).json({ error: 'Error al limpiar las actividades' });
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