const express = require('express');
const router = express.Router();

const { verifyToken } = require('../controllers/authController');
const {
  getPatientRecurringScheduleAdmin,
  createPatientRecurringScheduleAdmin,
  updatePatientRecurringScheduleAdmin,
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

// GET /api/admin/patients/:id/recurring
router.get('/:id/recurring', getPatientRecurringScheduleAdmin);
// POST /api/admin/patients/:id/recurring
router.post('/:id/recurring', createPatientRecurringScheduleAdmin);
// PATCH /api/admin/patients/:id/recurring — misma semántica que editar agenda (tabla RecurringAppointments + citas)
router.patch(
  '/:id/recurring',
  validate(recurringAppointmentsValidators.patientAdminPatchRecurring),
  updatePatientRecurringScheduleAdmin
);

module.exports = router;

