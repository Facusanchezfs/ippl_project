const Joi = require('joi');

const idParamSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

const createCancellationRequestSchema = Joi.object({
  body: Joi.object({
    appointmentId: Joi.number().integer().positive().required().messages({
      'any.required': 'appointmentId es requerido',
    }),
    reason: Joi.string().min(1).max(1000).required().messages({
      'string.min': 'La razón de cancelación no puede estar vacía',
      'string.max': 'La razón de cancelación no puede superar los 1000 caracteres',
      'any.required': 'reason es requerido',
    }),
  }),
});

const approveCancellationRequestSchema = Joi.object({
  params: idParamSchema,
});

const rejectCancellationRequestSchema = Joi.object({
  params: idParamSchema,
});

module.exports = {
  create: createCancellationRequestSchema,
  approve: approveCancellationRequestSchema,
  reject: rejectCancellationRequestSchema,
};

