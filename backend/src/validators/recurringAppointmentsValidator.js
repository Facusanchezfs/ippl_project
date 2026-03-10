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

module.exports = {
  create: createRecurringAppointmentSchema,
};

