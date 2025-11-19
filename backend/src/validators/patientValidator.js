const Joi = require('joi');

const createPatientSchema = Joi.object({
  body: Joi.object({
    name: Joi.string().min(1).max(255).required().messages({
      'string.min': 'El nombre no puede estar vacío',
      'string.max': 'El nombre no puede exceder 255 caracteres',
      'any.required': 'El nombre es requerido',
    }),
    description: Joi.string().allow(null, '').optional(),
    email: Joi.string().email().allow(null, '').optional(),
    phone: Joi.string().allow(null, '').optional(),
    status: Joi.string().valid('active', 'pending', 'inactive', 'absent', 'alta').optional(),
    assignedAt: Joi.date().allow(null).optional(),
    sessionFrequency: Joi.string().valid('weekly', 'biweekly', 'monthly').allow(null, '').optional(),
  }),
});

const assignPatientSchema = Joi.object({
  params: Joi.object({
    patientId: Joi.number().integer().positive().required(),
  }),
  body: Joi.object({
    professionalId: Joi.number().integer().positive().optional(),
    professionalName: Joi.string().optional(),
    status: Joi.string().valid('active', 'pending', 'inactive', 'absent', 'alta').optional(),
    assignedAt: Joi.date().allow(null).optional(),
    textNote: Joi.string().allow(null, '').optional(),
    audioNote: Joi.string().allow(null, '').optional(),
    sessionFrequency: Joi.string().valid('weekly', 'biweekly', 'monthly').allow(null, '').optional(),
    statusChangeReason: Joi.string().allow(null, '').optional(),
  }),
});

const getPatientByIdSchema = Joi.object({
  params: Joi.object({
    id: Joi.number().integer().positive().required(),
  }),
});

const getProfessionalPatientsSchema = Joi.object({
  params: Joi.object({
    professionalId: Joi.number().integer().positive().required(),
  }),
});

const deletePatientSchema = Joi.object({
  params: Joi.object({
    id: Joi.number().integer().positive().required(),
  }),
});

const requestDischargeSchema = Joi.object({
  params: Joi.object({
    patientId: Joi.number().integer().positive().required(),
  }),
  body: Joi.object({
    reason: Joi.string().allow('').optional(),
  }),
});

const requestActivationSchema = Joi.object({
  params: Joi.object({
    patientId: Joi.number().integer().positive().required(),
  }),
  body: Joi.object({
    reason: Joi.string().allow('').optional(),
  }),
});

module.exports = {
  create: createPatientSchema,
  assign: assignPatientSchema,
  getById: getPatientByIdSchema,
  getProfessionalPatients: getProfessionalPatientsSchema,
  delete: deletePatientSchema,
  requestDischarge: requestDischargeSchema,
  requestActivation: requestActivationSchema,
};

