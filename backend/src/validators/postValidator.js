const Joi = require('joi');

const createPostSchema = Joi.object({
  body: Joi.object({
    title: Joi.string().min(1).max(500).required().messages({
      'string.min': 'El título no puede estar vacío',
      'string.max': 'El título no puede exceder 500 caracteres',
      'any.required': 'El título es requerido',
    }),
    content: Joi.string().min(1).required().messages({
      'string.min': 'El contenido no puede estar vacío',
      'any.required': 'El contenido es requerido',
    }),
    section: Joi.string().min(1).required().messages({
      'any.required': 'La sección es requerida',
    }),
    excerpt: Joi.string().allow('').optional(),
    tags: Joi.alternatives().try(
      Joi.string(),
      Joi.array().items(Joi.string())
    ).optional(),
    seo: Joi.alternatives().try(
      Joi.string(),
      Joi.object()
    ).optional(),
    status: Joi.string().valid('draft', 'published').optional(),
    slug: Joi.string().optional(),
    featured: Joi.boolean().optional(),
    readTime: Joi.string().optional(),
  }),
});

const updatePostSchema = Joi.object({
  params: Joi.object({
    id: Joi.number().integer().positive().required(),
  }),
  body: Joi.object({
    title: Joi.string().min(1).max(500).optional(),
    content: Joi.string().min(1).optional(),
    section: Joi.string().min(1).optional(),
    excerpt: Joi.string().allow('').optional(),
    tags: Joi.alternatives().try(
      Joi.string(),
      Joi.array().items(Joi.string())
    ).optional(),
    seo: Joi.alternatives().try(
      Joi.string(),
      Joi.object()
    ).optional(),
    status: Joi.string().valid('draft', 'published').optional(),
    slug: Joi.string().allow(null, '').optional(),
    featured: Joi.boolean().optional(),
    readTime: Joi.string().optional(),
    thumbnail: Joi.string().allow(null, '').optional(),
    publishedAt: Joi.date().allow(null).optional(),
  }),
});

const getPostByIdSchema = Joi.object({
  params: Joi.object({
    id: Joi.number().integer().positive().required(),
  }),
});

const getPostBySlugSchema = Joi.object({
  params: Joi.object({
    slug: Joi.string().required(),
  }),
});

const getPostBySectionSchema = Joi.object({
  params: Joi.object({
    section: Joi.string().valid('ninos', 'adultos', 'noticias').required().messages({
      'any.only': 'La sección debe ser uno de los valores permitidos: ninos, adultos, noticias',
      'any.required': 'La sección es requerida',
    }),
  }),
});

const deletePostSchema = Joi.object({
  params: Joi.object({
    id: Joi.number().integer().positive().required(),
  }),
});

module.exports = {
  create: createPostSchema,
  update: updatePostSchema,
  getById: getPostByIdSchema,
  getBySlug: getPostBySlugSchema,
  getBySection: getPostBySectionSchema,
  delete: deletePostSchema,
};

