const Joi = require('joi');

const VALID_STATUSES = ['active', 'pending', 'inactive'];

const createRequestSchema = Joi.object({
  body: Joi.object({
    patientId: Joi.number().integer().positive().required().messages({
      'any.required': 'patientId es requerido',
    }),
    patientName: Joi.string().optional(),
    professionalId: Joi.number().integer().positive().optional(),
    professionalName: Joi.string().optional(),
    currentStatus: Joi.string().valid(...VALID_STATUSES).required().messages({
      'any.only': `El estado actual debe ser uno de: ${VALID_STATUSES.join(', ')}`,
      'any.required': 'currentStatus es requerido',
    }),
    requestedStatus: Joi.string().valid(...VALID_STATUSES).required().messages({
      'any.only': `El estado solicitado debe ser uno de: ${VALID_STATUSES.join(', ')}`,
      'any.required': 'requestedStatus es requerido',
    }),
    reason: Joi.string().allow(null, '').optional(),
    type: Joi.string().valid('activation', 'status_change').optional(),
  }),
});

const getRequestByIdSchema = Joi.object({
  params: Joi.object({
    requestId: Joi.number().integer().positive().required(),
  }),
});

const getProfessionalRequestsSchema = Joi.object({
  params: Joi.object({
    professionalId: Joi.number().integer().positive().required(),
  }),
});

const approveRequestSchema = Joi.object({
  params: Joi.object({
    requestId: Joi.number().integer().positive().required(),
  }),
  body: Joi.object({
    adminResponse: Joi.string().allow(null, '').optional(),
  }),
});

const rejectRequestSchema = Joi.object({
  params: Joi.object({
    requestId: Joi.number().integer().positive().required(),
  }),
  body: Joi.object({
    adminResponse: Joi.string().min(1).required().messages({
      'string.min': 'Se requiere una razón para el rechazo',
      'any.required': 'Se requiere una razón para el rechazo',
    }),
  }),
});

module.exports = {
  create: createRequestSchema,
  getById: getRequestByIdSchema,
  getProfessionalRequests: getProfessionalRequestsSchema,
  approve: approveRequestSchema,
  reject: rejectRequestSchema,
};

