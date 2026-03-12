const Joi = require('joi');

const createRecurringAppointmentSchema = Joi.object({
  body: Joi.object({
    baseAppointmentId: Joi.number().integer().positive().required().messages({
      'any.required': 'baseAppointmentId es requerido',
      'number.base': 'baseAppointmentId debe ser un número',
      'number.integer': 'baseAppointmentId debe ser un entero',
      'number.positive': 'baseAppointmentId debe ser un entero positivo',
    }),
    frequency: Joi.string()
      .valid('weekly', 'biweekly', 'monthly')
      .required()
      .messages({
        'any.only': 'frequency debe ser uno de: weekly, biweekly, monthly',
        'any.required': 'frequency es requerido',
      }),
  }),
});

const adminUpdateRecurringAppointmentSchema = Joi.object({
  params: Joi.object({
    id: Joi.number().integer().positive().required(),
  }),
  body: Joi.object({
    frequency: Joi.string().valid('weekly', 'biweekly', 'monthly').required(),
    nextDate: Joi.string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
      .required()
      .messages({
        'string.pattern.base': 'nextDate debe estar en formato YYYY-MM-DD',
        'any.required': 'nextDate es requerido',
      }),
    startTime: Joi.string()
      .pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
      .required()
      .messages({
        'string.pattern.base': 'startTime debe estar en formato HH:MM',
        'any.required': 'startTime es requerido',
      }),
    duration: Joi.number()
      .valid(30, 60)
      .required()
      .messages({
        'any.only': 'duration debe ser 30 o 60 minutos',
        'any.required': 'duration es requerido',
      }),
    sessionCost: Joi.number().min(0).required().messages({
      'number.min': 'sessionCost debe ser mayor o igual a 0',
      'any.required': 'sessionCost es requerido',
    }),
  }),
});

module.exports = {
  create: createRecurringAppointmentSchema,
  adminUpdate: adminUpdateRecurringAppointmentSchema,
};

