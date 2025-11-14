'use strict';

const { Appointment } = require('../../models');
const logger = require('../utils/logger');

async function preloadAppointmentForWrite(req, res, next) {
  try {
    const { id } = req.params;

    // Soft delete: solo citas activas
    const appointment = await Appointment.findOne({
      where: { id, active: true },
    });

    if (!appointment) {
      return res.status(404).json({ message: 'Cita no encontrada' });
    }

    const isAdmin = req.user?.role === 'admin';
    const isOwner =
      String(appointment.professionalId ?? '') === String(req.user?.id ?? '');

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: 'Acceso denegado' });
    }

    // Inyectamos la cita para reutilizar en el controller
    req.appointment = appointment;
    next();
  } catch (err) {
    logger.error('[appointmentsAuth] Error en preloadAppointmentForWrite:', err);
    res.status(500).json({ message: 'Error al verificar permisos' });
  }
}

module.exports = { preloadAppointmentForWrite };
