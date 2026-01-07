const express = require('express');
const router = express.Router();
const { verifyToken } = require('../controllers/authController');
const { getMonthlyRevenue } = require('../controllers/reportsController');
const { sendError } = require('../utils/response');

router.use(verifyToken);

router.use((req, res, next) => {
  if (req.user.role !== 'admin') {
    return sendError(res, 403, 'Acceso denegado. Solo administradores pueden acceder a los reportes');
  }
  next();
});

router.get('/monthly-revenue', getMonthlyRevenue);

module.exports = router;

