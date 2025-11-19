/**
 * Middleware de validación con Joi
 * Valida req.body, req.params y req.query según el schema proporcionado
 */
const { sendError } = require('../utils/response');

const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(
      {
        body: req.body,
        params: req.params,
        query: req.query,
      },
      {
        abortEarly: false, // Mostrar todos los errores, no solo el primero
        stripUnknown: true, // Eliminar campos no definidos en el schema
      }
    );

    if (error) {
      const details = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return sendError(res, 400, 'Validation error', { details });
    }

    // Reemplazar los valores validados
    req.body = value.body || req.body;
    req.params = value.params || req.params;
    req.query = value.query || req.query;

    next();
  };
};

module.exports = validate;

