const express = require('express');
const router = express.Router();
const { authenticateToken, checkRole } = require('../middleware/auth');

const {
  createVacationRequest,
  listVacationRequestsAdmin,
  listMyVacationRequests,
  approveVacationRequest,
  rejectVacationRequest,
} = require('../controllers/vacationRequestController');

// Profesional crea solicitud de vacaciones
router.post(
  '/',
  authenticateToken,
  checkRole(['professional']),
  createVacationRequest
);

// Profesional ve sus propias solicitudes
router.get(
  '/me',
  authenticateToken,
  checkRole(['professional']),
  listMyVacationRequests
);

// Admin ve todas las solicitudes
router.get(
  '/',
  authenticateToken,
  checkRole(['admin']),
  listVacationRequestsAdmin
);

// Admin aprueba solicitud
router.post(
  '/:id/approve',
  authenticateToken,
  checkRole(['admin']),
  approveVacationRequest
);

// Admin rechaza solicitud
router.post(
  '/:id/reject',
  authenticateToken,
  checkRole(['admin']),
  rejectVacationRequest
);

module.exports = router;

