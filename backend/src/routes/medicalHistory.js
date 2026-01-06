const express = require('express');
const router = express.Router();
const { authenticateToken, checkRole } = require('../middleware/auth');
const {
  getMedicalHistories,
  getMedicalHistoryById,
  createMedicalHistory,
  updateMedicalHistory,
  deleteMedicalHistory
} = require('../controllers/medicalHistoryController');
const validate = require('../middleware/validate');
const medicalHistoryValidators = require('../validators/medicalHistoryValidator');

router.get('/', authenticateToken, checkRole(['admin', 'professional']), validate(medicalHistoryValidators.getHistories), getMedicalHistories);

router.get('/patient/:patientId', authenticateToken, checkRole(['admin', 'professional']), validate(medicalHistoryValidators.getHistories), getMedicalHistories);

router.get('/professional/:professionalId', authenticateToken, checkRole(['admin', 'professional']), validate(medicalHistoryValidators.getHistories), getMedicalHistories);

router.get('/:id', authenticateToken, checkRole(['admin', 'professional']), validate(medicalHistoryValidators.getById), getMedicalHistoryById);

router.post('/', authenticateToken, checkRole(['professional']), validate(medicalHistoryValidators.create), createMedicalHistory);

router.put('/:id', authenticateToken, checkRole(['professional']), validate(medicalHistoryValidators.update), updateMedicalHistory);

router.delete('/:id', authenticateToken, checkRole(['admin']), validate(medicalHistoryValidators.delete), deleteMedicalHistory);

module.exports = router; 