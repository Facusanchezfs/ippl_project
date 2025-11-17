const express = require('express');
const router = express.Router();
const { preloadAppointmentForWrite } = require('../middleware/appointment');
const { authenticateToken } = require('../middleware/auth');
const { verifyToken } = require('../controllers/authController');
const {
  getAllAppointments,
  getProfessionalAppointments,
  getTodayProfessionalAppointments,
  getPatientAppointments,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  getAvailableSlots,
  getUpcomingAppointments
} = require('../controllers/appointmentsController');
const validate = require('../middleware/validate');
const appointmentValidators = require('../validators/appointmentsValidator');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Rutas públicas (requieren autenticación pero no roles específicos)
router.get('/professional/:professionalId', validate(appointmentValidators.getProfessionalAppointments), getProfessionalAppointments);
router.get('/professional/today/:professionalId', validate(appointmentValidators.getProfessionalAppointments), getTodayProfessionalAppointments);
router.get('/patient/:patientId', validate(appointmentValidators.getPatientAppointments), getPatientAppointments);
router.get('/slots/:professionalId', validate(appointmentValidators.getAvailableSlots), getAvailableSlots);
router.get('/upcoming', getUpcomingAppointments);

// Rutas que requieren ser admin o el profesional asignado
router.get('/', getAllAppointments);

router.post('/', validate(appointmentValidators.create), createAppointment);

router.put('/:id',
  authenticateToken,
  validate(appointmentValidators.update),
  preloadAppointmentForWrite,
  updateAppointment
);

router.delete('/:id',
  authenticateToken,
  validate(appointmentValidators.delete),
  preloadAppointmentForWrite,
  deleteAppointment
);

module.exports = router;