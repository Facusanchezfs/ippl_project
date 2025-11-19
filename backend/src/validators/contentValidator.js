const Joi = require('joi');

const deleteCarouselImageSchema = Joi.object({
  params: Joi.object({
    filename: Joi.string().required().messages({
      'any.required': 'El nombre del archivo es requerido',
    }),
  }),
});

module.exports = {
  deleteCarouselImage: deleteCarouselImageSchema,
};

