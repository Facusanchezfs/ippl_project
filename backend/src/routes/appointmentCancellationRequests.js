const express = require('express');
const router = express.Router();

const { authenticateToken, checkRole } = require('../middleware/auth');
const {
  createCancellationRequest,
  listCancellationRequests,
  approveCancellationRequest,
  rejectCancellationRequest,
} = require('../controllers/appointmentCancellationController');
const validate = require('../middleware/validate');
const appointmentCancellationValidator = require('../validators/appointmentCancellationValidator');

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Profesional crea solicitud de cancelación
router.post(
  '/',
  checkRole(['professional']),
  validate(appointmentCancellationValidator.create),
  createCancellationRequest
);

// Admin/financial listan solicitudes
router.get(
  '/',
  checkRole(['admin', 'financial']),
  listCancellationRequests
);

// Admin/financial aprueban solicitud
router.patch(
  '/:id/approve',
  checkRole(['admin', 'financial']),
  validate(appointmentCancellationValidator.approve),
  approveCancellationRequest
);

// Admin/financial rechazan solicitud
router.patch(
  '/:id/reject',
  checkRole(['admin', 'financial']),
  validate(appointmentCancellationValidator.reject),
  rejectCancellationRequest
);

module.exports = router;

