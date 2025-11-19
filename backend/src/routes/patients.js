const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getAllPatients, getProfessionalPatients, assignPatient, addPatient, deletePatient, requestDischargePatient, requestActivationPatient } = require('../controllers/patientController');
const validate = require('../middleware/validate');
const patientValidators = require('../validators/patientValidator');

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Rutas
router.get('/', getAllPatients);
router.get('/professional/:professionalId', validate(patientValidators.getProfessionalPatients), getProfessionalPatients);
router.put('/:patientId/assign', validate(patientValidators.assign), assignPatient);
router.post('/', validate(patientValidators.create), addPatient);
router.delete('/:id', validate(patientValidators.delete), deletePatient);
router.post('/:patientId/request-discharge', validate(patientValidators.requestDischarge), requestDischargePatient);
router.post('/:patientId/request-activation', validate(patientValidators.requestActivation), requestActivationPatient);

module.exports = router; 