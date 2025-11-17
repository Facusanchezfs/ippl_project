const Joi = require('joi');

const createMessageSchema = Joi.object({
  body: Joi.object({
    nombre: Joi.string().min(1).max(255).required().messages({
      'string.min': 'El nombre no puede estar vacío',
      'string.max': 'El nombre no puede exceder 255 caracteres',
      'any.required': 'El nombre es requerido',
    }),
    apellido: Joi.string().min(1).max(255).required().messages({
      'string.min': 'El apellido no puede estar vacío',
      'string.max': 'El apellido no puede exceder 255 caracteres',
      'any.required': 'El apellido es requerido',
    }),
    correoElectronico: Joi.string().email().required().messages({
      'string.email': 'El correo electrónico debe ser válido',
      'any.required': 'El correo electrónico es requerido',
    }),
    mensaje: Joi.string().min(1).required().messages({
      'string.min': 'El mensaje no puede estar vacío',
      'any.required': 'El mensaje es requerido',
    }),
    fecha: Joi.date().optional(),
  }),
});

const markAsReadSchema = Joi.object({
  params: Joi.object({
    id: Joi.number().integer().positive().required(),
  }),
});

module.exports = {
  create: createMessageSchema,
  markAsRead: markAsReadSchema,
};

