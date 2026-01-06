const logger = require('../utils/logger');

/**
 * Middleware para loguear errores de forma estructurada
 * Captura todos los errores, los loguea y luego deja que Express responda
 */
const errorLogger = (err, req, res, next) => {
	const { method, path: routePath, ip } = req;
	const clientIp = req.ip || req.connection.remoteAddress || ip;
	
	const errorName = err.name || 'Error';
	const errorMessage = err.message || 'Error desconocido';
	const errorStack = err.stack || '';
	
	const cleanStack = errorStack
		.split('\n')
		.slice(0, 5)
		.join('\n');
	
	const logMessage = `${method} ${routePath} → ${errorName}: ${errorMessage}`;
	
	logger.error(logMessage, {
		ip: clientIp,
		error: {
			name: errorName,
			message: errorMessage,
			stack: cleanStack,
		},
		timestamp: new Date().toISOString(),
	});
	
	next(err);
};

module.exports = errorLogger;

