const Joi = require('joi');

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const createMedicalHistorySchema = Joi.object({
  body: Joi.object({
    patientId: Joi.alternatives().try(
      Joi.number().integer().positive(),
      Joi.string().pattern(/^\d+$/).custom((value) => parseInt(value, 10))
    ).required().messages({
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
    notes: Joi.string().allow('').optional(),
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
    patientId: Joi.alternatives().try(
      Joi.number().integer().positive(),
      Joi.string().pattern(/^\d+$/)
    ).optional(),
    professionalId: Joi.alternatives().try(
      Joi.number().integer().positive(),
      Joi.string().pattern(/^\d+$/)
    ).optional(),
  }).optional(),
  query: Joi.object({
    patientId: Joi.alternatives().try(
      Joi.number().integer().positive(),
      Joi.string().pattern(/^\d+$/)
    ).optional(),
    professionalId: Joi.alternatives().try(
      Joi.number().integer().positive(),
      Joi.string().pattern(/^\d+$/)
    ).optional(),
  }).optional(),
}).custom((value, helpers) => {
  const patientId = value.params?.patientId ?? value.query?.patientId;
  const professionalId = value.params?.professionalId ?? value.query?.professionalId;
  
  if (!patientId && !professionalId) {
    return helpers.error('any.custom', {
      message: 'Debe proporcionar patientId o professionalId en params o query'
    });
  }
  
  return value;
}, 'validate at least one id is provided');

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

