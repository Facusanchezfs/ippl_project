const express = require('express');
const router = express.Router();
const { authenticateToken, checkRole } = require('../middleware/auth');
const {
  createRequest,
  getPendingRequests,
  getProfessionalRequests,
  getPatientPendingRequests,
  approveRequest,
  rejectRequest,
} = require('../controllers/statusRequestController');
const validate = require('../middleware/validate');
const statusRequestValidators = require('../validators/statusRequestValidator');

// Rutas para profesionales
router.get('/professional/:professionalId', authenticateToken, checkRole(['professional']), validate(statusRequestValidators.getProfessionalRequests), getProfessionalRequests);
router.post('/status-change', authenticateToken, checkRole(['professional']), validate(statusRequestValidators.create), createRequest);

// Rutas para admin
// IMPORTANTE: Las rutas más específicas deben ir ANTES que las genéricas
// Orden: específicas primero, luego genéricas
router.get('/patient/:patientId/pending', authenticateToken, checkRole(['admin', 'financial']), getPatientPendingRequests);
router.get('/pending', authenticateToken, checkRole(['admin', 'financial']), getPendingRequests);
router.post('/:requestId/approve', authenticateToken, checkRole(['admin', 'financial']), validate(statusRequestValidators.approve), approveRequest);
router.post('/:requestId/reject', authenticateToken, checkRole(['admin', 'financial']), validate(statusRequestValidators.reject), rejectRequest);

module.exports = router; 