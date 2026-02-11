const express = require('express');
const router = express.Router();
const { preloadAppointmentForWrite } = require('../middleware/appointment');
const { authenticateToken } = require('../middleware/auth');
const { verifyToken } = require('../controllers/authController');
const {
  getAllAppointments,
  getProfessionalAppointments,
  getTodayProfessionalAppointments,
  getCompletedProfessionalAppointments,
  getPatientAppointments,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  getAvailableSlots,
  getUpcomingAppointments
} = require('../controllers/appointmentsController');
const validate = require('../middleware/validate');
const appointmentValidators = require('../validators/appointmentsValidator');

router.use(verifyToken);

router.get('/professional/:professionalId', validate(appointmentValidators.getProfessionalAppointments), getProfessionalAppointments);
router.get('/professional/today/:professionalId', validate(appointmentValidators.getProfessionalAppointments), getTodayProfessionalAppointments);
router.get( "/professional/:professionalId/completed", getCompletedProfessionalAppointments );

router.get('/patient/:patientId', validate(appointmentValidators.getPatientAppointments), getPatientAppointments);
router.get('/slots/:professionalId', validate(appointmentValidators.getAvailableSlots), getAvailableSlots);
router.get('/upcoming', getUpcomingAppointments);

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