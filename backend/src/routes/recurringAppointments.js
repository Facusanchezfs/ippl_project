const express = require('express');
const router = express.Router();

const { verifyToken } = require('../controllers/authController');
const { createRecurringAppointment } = require('../controllers/recurringAppointmentsController');
const validate = require('../middleware/validate');
const recurringAppointmentsValidators = require('../validators/recurringAppointmentsValidator');

// Todas las rutas de citas recurrentes requieren un token válido
router.use(verifyToken);

// POST /recurring-appointments
router.post(
  '/',
  validate(recurringAppointmentsValidators.create),
  createRecurringAppointment
);

module.exports = router;

