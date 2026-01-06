const Joi = require('joi');

// Validar formato HH:MM
const timePattern = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
// Validar formato YYYY-MM-DD
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const createAppointmentSchema = Joi.object({
  body: Joi.object({
    patientId: Joi.number().integer().positive().required().messages({
      'any.required': 'patientId es requerido',
    }),
    professionalId: Joi.number().integer().positive().required().messages({
      'any.required': 'professionalId es requerido',
    }),
    date: Joi.string().pattern(datePattern).required().messages({
      'string.pattern.base': 'La fecha debe estar en formato YYYY-MM-DD',
      'any.required': 'La fecha es requerida',
    }),
    startTime: Joi.string().pattern(timePattern).required().messages({
      'string.pattern.base': 'startTime debe estar en formato HH:MM',
      'any.required': 'startTime es requerido',
    }),
    endTime: Joi.string().pattern(timePattern).required().messages({
      'string.pattern.base': 'endTime debe estar en formato HH:MM',
      'any.required': 'endTime es requerido',
    }),
    type: Joi.string().valid('regular', 'first_time', 'emergency').optional(),
    notes: Joi.string().allow(null, '').optional(),
    audioNote: Joi.string().allow(null, '').optional(),
    sessionCost: Joi.number().min(0).optional(),
  }),
});

const updateAppointmentSchema = Joi.object({
  params: Joi.object({
    id: Joi.number().integer().positive().required(),
  }),
  body: Joi.object({
    date: Joi.string().pattern(datePattern).optional(),
    startTime: Joi.string().pattern(timePattern).optional(),
    endTime: Joi.string().pattern(timePattern).optional(),
    type: Joi.string().valid('regular', 'first_time', 'emergency').optional(),
    status: Joi.string().valid('scheduled', 'completed', 'cancelled').optional(),
    notes: Joi.string().allow(null, '').optional(),
    audioNote: Joi.string().allow(null, '').optional(),
    sessionCost: Joi.number().min(0).optional(),
    attended: Joi.boolean().optional(),
    paymentAmount: Joi.number().min(0).optional(),
    noShowPaymentAmount: Joi.number().min(0).allow(null).optional(),
    patientId: Joi.number().integer().positive().optional(),
    professionalId: Joi.number().integer().positive().optional(),
  }),
});

const getAppointmentByIdSchema = Joi.object({
  params: Joi.object({
    id: Joi.number().integer().positive().required(),
  }),
});

const getProfessionalAppointmentsSchema = Joi.object({
  params: Joi.object({
    professionalId: Joi.number().integer().positive().required(),
  }),
});

const getPatientAppointmentsSchema = Joi.object({
  params: Joi.object({
    patientId: Joi.number().integer().positive().required(),
  }),
});

const getAvailableSlotsSchema = Joi.object({
  params: Joi.object({
    professionalId: Joi.number().integer().positive().required(),
  }),
  query: Joi.object({
    date: Joi.string().pattern(datePattern).required().messages({
      'string.pattern.base': 'La fecha debe estar en formato YYYY-MM-DD',
      'any.required': 'La fecha es requerida',
    }),
  }),
});

const deleteAppointmentSchema = Joi.object({
  params: Joi.object({
    id: Joi.number().integer().positive().required(),
  }),
});

module.exports = {
  create: createAppointmentSchema,
  update: updateAppointmentSchema,
  getById: getAppointmentByIdSchema,
  getProfessionalAppointments: getProfessionalAppointmentsSchema,
  getPatientAppointments: getPatientAppointmentsSchema,
  getAvailableSlots: getAvailableSlotsSchema,
  delete: deleteAppointmentSchema,
};

