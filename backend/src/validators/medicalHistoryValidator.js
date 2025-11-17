const Joi = require('joi');

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const createMedicalHistorySchema = Joi.object({
  body: Joi.object({
    patientId: Joi.number().integer().positive().required().messages({
      'any.required': 'patientId es requerido',
    }),
    date: Joi.string().pattern(datePattern).required().messages({
      'string.pattern.base': 'La fecha debe estar en formato YYYY-MM-DD',
      'any.required': 'La fecha es requerida',
    }),
    diagnosis: Joi.string().min(1).required().messages({
      'string.min': 'El diagnóstico no puede estar vacío',
      'any.required': 'El diagnóstico es requerido',
    }),
    treatment: Joi.string().min(1).required().messages({
      'string.min': 'El tratamiento no puede estar vacío',
      'any.required': 'El tratamiento es requerido',
    }),
    notes: Joi.string().min(1).required().messages({
      'string.min': 'Las notas no pueden estar vacías',
      'any.required': 'Las notas son requeridas',
    }),
  }),
});

const updateMedicalHistorySchema = Joi.object({
  params: Joi.object({
    id: Joi.number().integer().positive().required(),
  }),
  body: Joi.object({
    diagnosis: Joi.string().min(1).optional(),
    treatment: Joi.string().min(1).optional(),
    notes: Joi.string().min(1).optional(),
  }),
});

const getMedicalHistoryByIdSchema = Joi.object({
  params: Joi.object({
    id: Joi.number().integer().positive().required(),
  }),
});

const getMedicalHistoriesSchema = Joi.object({
  params: Joi.object({
    patientId: Joi.number().integer().positive().optional(),
    professionalId: Joi.number().integer().positive().optional(),
  }).or('patientId', 'professionalId'),
  query: Joi.object({
    patientId: Joi.number().integer().positive().optional(),
    professionalId: Joi.number().integer().positive().optional(),
  }).or('patientId', 'professionalId'),
}).or('params', 'query');

const deleteMedicalHistorySchema = Joi.object({
  params: Joi.object({
    id: Joi.number().integer().positive().required(),
  }),
});

module.exports = {
  create: createMedicalHistorySchema,
  update: updateMedicalHistorySchema,
  getById: getMedicalHistoryByIdSchema,
  getHistories: getMedicalHistoriesSchema,
  delete: deleteMedicalHistorySchema,
};

