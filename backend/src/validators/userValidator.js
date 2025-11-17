const Joi = require('joi');

const createUserSchema = Joi.object({
  body: Joi.object({
    name: Joi.string().min(1).max(255).required().messages({
      'string.min': 'El nombre no puede estar vacío',
      'string.max': 'El nombre no puede exceder 255 caracteres',
      'any.required': 'El nombre es requerido',
    }),
    email: Joi.string().email().required().messages({
      'string.email': 'El email debe ser válido',
      'any.required': 'El email es requerido',
    }),
    password: Joi.string().min(6).required().messages({
      'string.min': 'La contraseña debe tener al menos 6 caracteres',
      'any.required': 'La contraseña es requerida',
    }),
    role: Joi.string().valid('admin', 'professional', 'content_manager').required().messages({
      'any.only': 'El rol debe ser admin, professional o content_manager',
      'any.required': 'El rol es requerido',
    }),
    status: Joi.string().valid('active', 'inactive').optional(),
    commission: Joi.number().min(0).max(100).optional(),
    saldoTotal: Joi.number().min(0).optional(),
    saldoPendiente: Joi.number().min(0).optional(),
  }),
});

const updateUserSchema = Joi.object({
  params: Joi.object({
    id: Joi.number().integer().positive().required(),
  }),
  body: Joi.object({
    name: Joi.string().min(1).max(255).optional(),
    email: Joi.string().email().optional(),
    password: Joi.string().min(6).optional(),
    role: Joi.string().valid('admin', 'professional', 'content_manager').optional(),
    status: Joi.string().valid('active', 'inactive').optional(),
    commission: Joi.number().min(0).max(100).optional(),
    saldoTotal: Joi.number().min(0).optional(),
    saldoPendiente: Joi.number().min(0).optional(),
    lastLogin: Joi.date().optional(),
  }),
});

const getUserByIdSchema = Joi.object({
  params: Joi.object({
    id: Joi.number().integer().positive().required(),
  }),
});

const deleteUserSchema = Joi.object({
  params: Joi.object({
    id: Joi.number().integer().positive().required(),
  }),
});

const abonarComisionSchema = Joi.object({
  params: Joi.object({
    id: Joi.number().integer().positive().required(),
  }),
  body: Joi.object({
    abono: Joi.number().positive().required().messages({
      'number.positive': 'El abono debe ser un número positivo',
      'any.required': 'El abono es requerido',
    }),
  }),
});

module.exports = {
  create: createUserSchema,
  update: updateUserSchema,
  getById: getUserByIdSchema,
  delete: deleteUserSchema,
  abonarComision: abonarComisionSchema,
};

