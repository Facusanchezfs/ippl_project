const express = require('express');
const router = express.Router();
const { verifyToken } = require('../controllers/authController');
const { getSystemStats, getProfessionalStats } = require('../controllers/statsController');

router.use(verifyToken);

const { sendError } = require('../utils/response');

router.get('/system', (req, res, next) => {
  if (req.user.role !== 'admin') {
    return sendError(res, 403, 'Acceso denegado');
  }
  next();
}, getSystemStats);

router.get('/professional/:professionalId', (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.id !== req.params.professionalId) {
    return sendError(res, 403, 'Acceso denegado');
  }
  next();
}, getProfessionalStats);

module.exports = router; 