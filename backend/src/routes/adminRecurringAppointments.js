const express = require('express');
const router = express.Router();
const { verifyToken } = require('../controllers/authController');
const {
  updateRecurringAppointmentAdmin,
  updateRecurringAppointmentGroupAdmin,
} = require('../controllers/recurringAppointmentsController');
const validate = require('../middleware/validate');
const recurringAppointmentsValidators =
  require('../validators/recurringAppointmentsValidator');

router.use(verifyToken);

router.use((req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado. Solo administradores.',
    });
  }
  next();
});

// IMPORTANTE: /group/:groupId ANTES que /:id
router.patch(
  '/group/:groupId',
  updateRecurringAppointmentGroupAdmin
);

router.patch(
  '/:id',
  validate(recurringAppointmentsValidators.adminUpdate),
  updateRecurringAppointmentAdmin
);

module.exports = router;

