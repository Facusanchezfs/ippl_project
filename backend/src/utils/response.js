/**
 * Helpers para normalizar respuestas HTTP del backend
 * Todas las respuestas exitosas y de error deben usar estos helpers
 */

/**
 * Envía una respuesta exitosa
 * @param {Object} res - Objeto response de Express
 * @param {*} data - Datos a enviar (puede ser cualquier tipo)
 * @param {string} [message] - Mensaje opcional
 * @param {number} [statusCode=200] - Código de estado HTTP (200, 201, 204)
 */
const sendSuccess = (res, data, message = null, statusCode = 200) => {
  const response = {
    success: true,
  };

  if (data !== undefined && data !== null) {
    response.data = data;
  }

  if (message) {
    response.message = message;
  }

  // Para 204 No Content, no enviamos body
  if (statusCode === 204) {
    return res.status(204).send();
  }

  return res.status(statusCode).json(response);
};

/**
 * Envía una respuesta de error
 * @param {Object} res - Objeto response de Express
 * @param {number} statusCode - Código de estado HTTP (400, 401, 403, 404, 409, 500)
 * @param {string} error - Mensaje de error
 * @param {Object} [details] - Detalles adicionales del error (opcional)
 */
const sendError = (res, statusCode, error, details = null) => {
  const response = {
    success: false,
    error,
  };

  if (details !== null && details !== undefined) {
    response.details = details;
  }

  return res.status(statusCode).json(response);
};

module.exports = {
  sendSuccess,
  sendError,
};

