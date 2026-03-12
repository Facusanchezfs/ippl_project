const express = require('express');
const router = express.Router();

const { verifyToken } = require('../controllers/authController');
const {
  updateRecurringAppointmentAdmin,
} = require('../controllers/recurringAppointmentsController');
const validate = require('../middleware/validate');
const recurringAppointmentsValidators = require('../validators/recurringAppointmentsValidator');

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

// PATCH /admin/recurring-appointments/:id
router.patch(
  '/:id',
  validate(recurringAppointmentsValidators.adminUpdate),
  updateRecurringAppointmentAdmin
);

module.exports = router;

