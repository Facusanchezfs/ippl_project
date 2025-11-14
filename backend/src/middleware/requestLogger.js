const logger = require('../utils/logger');

/**
 * Middleware para loguear todas las requests HTTP
 * Registra: método, ruta, código de respuesta, IP, tiempo de respuesta
 */
const requestLogger = (req, res, next) => {
	const startTime = Date.now();
	const { method, path: routePath, ip } = req;

	// Interceptar el método end de la respuesta para calcular tiempo
	const originalEnd = res.end;
	res.end = function (...args) {
		const duration = Date.now() - startTime;
		const statusCode = res.statusCode;
		
		// Obtener IP real (considerando proxy)
		const clientIp = req.ip || req.connection.remoteAddress || ip;
		
		// Formato: HTTP METHOD /route - STATUS - DURATIONms
		const logMessage = `HTTP ${method} ${routePath} - ${statusCode} - ${duration}ms`;
		
		// Log según nivel de respuesta
		if (statusCode >= 500) {
			logger.error(logMessage, { ip: clientIp });
		} else if (statusCode >= 400) {
			logger.warn(logMessage, { ip: clientIp });
		} else {
			logger.info(logMessage, { ip: clientIp });
		}
		
		// Llamar al método original
		originalEnd.apply(res, args);
	};

	next();
};

module.exports = requestLogger;

