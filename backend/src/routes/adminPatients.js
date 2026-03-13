const express = require('express');
const router = express.Router();

const { verifyToken } = require('../controllers/authController');
const {
  getPatientRecurringScheduleAdmin,
  createPatientRecurringScheduleAdmin,
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
// POST /api/admin/patients/:id/recurring
router.post('/:id/recurring', createPatientRecurringScheduleAdmin);

module.exports = router;

