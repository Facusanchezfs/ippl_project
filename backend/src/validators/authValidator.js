const Joi = require('joi');

const loginSchema = Joi.object({
  body: Joi.object({
    username: Joi.string().email().required().messages({
      'string.email': 'El username debe ser un email válido',
      'any.required': 'El username es requerido',
    }),
    password: Joi.string().min(1).required().messages({
      'string.min': 'La contraseña no puede estar vacía',
      'any.required': 'La contraseña es requerida',
    }),
  }),
});

const refreshTokenSchema = Joi.object({
  body: Joi.object({
    token: Joi.string().required().messages({
      'any.required': 'El token es requerido',
    }),
  }),
});

module.exports = {
  login: loginSchema,
  refreshToken: refreshTokenSchema,
};

