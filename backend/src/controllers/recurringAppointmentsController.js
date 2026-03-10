const { Appointment, RecurringAppointment, sequelize } = require('../../models');
const logger = require('../utils/logger');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Crea una configuración de cita recurrente a partir de una cita base existente.
 *
 * Reglas:
 * - La cita base debe existir y estar activa.
 * - Solo el profesional dueño de la cita o un admin puede crear la recurrencia.
 * - Solo puede existir una recurrencia por cita base.
 * - patientId y professionalId se copian desde la cita base.
 */
const createRecurringAppointment = async (req, res) => {
  const { baseAppointmentId, frequency } = req.body;

  try {
    const result = await sequelize.transaction(async (t) => {
      // 1) Buscar cita base
      const baseAppointment = await Appointment.findOne({
        where: { id: baseAppointmentId, active: true },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!baseAppointment) {
        throw new Error('BASE_APPOINTMENT_NOT_FOUND');
      }

      // 2) Verificar autorización: dueño de la cita o admin
      const isAdmin = req.user?.role === 'admin';
      const isOwner =
        String(baseAppointment.professionalId ?? '') ===
        String(req.user?.id ?? '');

      if (!isAdmin && !isOwner) {
        throw new Error('ACCESS_DENIED');
      }

      // 3) Crear RecurringAppointment copiando datos de la cita base
      // El constraint UNIQUE en baseAppointmentId previene duplicados a nivel de BD
      const created = await RecurringAppointment.create(
        {
          patientId: baseAppointment.patientId,
          professionalId: baseAppointment.professionalId,
          baseAppointmentId,
          frequency,
          active: true,
        },
        { transaction: t }
      );

      return created;
    });

    return sendSuccess(
      res,
      result,
      'Configuración de cita recurrente creada correctamente',
      201
    );
  } catch (error) {
    // Manejo de errores de negocio lanzados dentro de la transacción
    if (error.message === 'BASE_APPOINTMENT_NOT_FOUND') {
      return sendError(res, 404, 'Cita base no encontrada o eliminada');
    }

    if (error.message === 'ACCESS_DENIED') {
      return sendError(res, 403, 'Acceso denegado');
    }

    // Manejo de constraint único a nivel de base de datos
    if (error.name === 'SequelizeUniqueConstraintError') {
      return sendError(
        res,
        409,
        'Ya existe una configuración de recurrencia para esta cita'
      );
    }

    // Error genérico
    logger.error(
      '[createRecurringAppointment] Error al crear recurrencia de cita:',
      error
    );
    return sendError(
      res,
      500,
      'Error al crear configuración de cita recurrente'
    );
  }
};

module.exports = {
  createRecurringAppointment,
};

