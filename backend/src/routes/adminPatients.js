const express = require('express');
const router = express.Router();

const { verifyToken } = require('../controllers/authController');
const {
  getPatientRecurringScheduleAdmin,
} = require('../controllers/recurringAppointmentsController');

// Todas las rutas requieren token válido
router.use(verifyToken);

// Solo ADMIN
router.use((req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res
      .status(403)
      .json({ success: false, message: 'Acceso denegado. Solo administradores.' });
  }
  next();
});

// GET /api/admin/patients/:id/recurring
router.get('/:id/recurring', getPatientRecurringScheduleAdmin);

module.exports = router;

