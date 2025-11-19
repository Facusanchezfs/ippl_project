/**
 * Configuración de Rate Limiting
 * 
 * Protege la API contra ataques de fuerza bruta, DoS y abuso de recursos.
 */

const rateLimit = require('express-rate-limit');

/**
 * Rate limiter global para todas las rutas
 * 100 requests por minuto por IP
 */
const globalLimiter = rateLimit({
	windowMs: 60 * 1000, // 1 minuto
	max: 100, // 100 requests por ventana
	message: {
		error: 'Demasiadas solicitudes desde esta IP, por favor intenta nuevamente en un minuto.',
		code: 'RATE_LIMIT_EXCEEDED'
	},
	standardHeaders: true, // Retorna información de rate limit en headers `RateLimit-*`
	legacyHeaders: false, // Deshabilita headers `X-RateLimit-*`
});

/**
 * Rate limiter estricto para login
 * 5 intentos cada 15 minutos por IP
 * Previene ataques de fuerza bruta
 */
const loginLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutos
	max: 5, // 5 intentos por ventana
	message: {
		error: 'Demasiados intentos de inicio de sesión. Por favor intenta nuevamente en 15 minutos.',
		code: 'LOGIN_RATE_LIMIT_EXCEEDED'
	},
	standardHeaders: true,
	legacyHeaders: false,
	// Saltar rate limit si la request es exitosa (opcional, pero puede ser útil)
	skipSuccessfulRequests: false,
});

/**
 * Rate limiter para endpoints de escritura (POST, PUT, DELETE, PATCH)
 * 20 requests por minuto por IP
 * Protege contra abuso de operaciones que modifican datos
 */
const writeLimiter = rateLimit({
	windowMs: 60 * 1000, // 1 minuto
	max: 20, // 20 requests por ventana
	message: {
		error: 'Demasiadas solicitudes de escritura desde esta IP. Por favor intenta nuevamente en un minuto.',
		code: 'WRITE_RATE_LIMIT_EXCEEDED'
	},
	standardHeaders: true,
	legacyHeaders: false,
	// Solo aplicar a métodos de escritura
	skip: (req) => {
		const writeMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
		return !writeMethods.includes(req.method);
	},
});

module.exports = {
	globalLimiter,
	loginLimiter,
	writeLimiter
};

