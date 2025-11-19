const logger = require('../utils/logger');

/**
 * Middleware para loguear errores de forma estructurada
 * Captura todos los errores, los loguea y luego deja que Express responda
 */
const errorLogger = (err, req, res, next) => {
	const { method, path: routePath, ip } = req;
	const clientIp = req.ip || req.connection.remoteAddress || ip;
	
	// Extraer información del error
	const errorName = err.name || 'Error';
	const errorMessage = err.message || 'Error desconocido';
	const errorStack = err.stack || '';
	
	// Limpiar stack (solo primeras 5 líneas para no saturar logs)
	const cleanStack = errorStack
		.split('\n')
		.slice(0, 5)
		.join('\n');
	
	// Construir mensaje de log
	const logMessage = `${method} ${routePath} → ${errorName}: ${errorMessage}`;
	
	// Log con contexto completo
	logger.error(logMessage, {
		ip: clientIp,
		error: {
			name: errorName,
			message: errorMessage,
			stack: cleanStack,
		},
		timestamp: new Date().toISOString(),
	});
	
	// Continuar con el siguiente middleware de error
	next(err);
};

module.exports = errorLogger;

