const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

const isProduction = process.env.NODE_ENV === 'production';
const logsDir = path.join(__dirname, '../../logs');

// Crear directorio de logs si no existe
if (!fs.existsSync(logsDir)) {
	fs.mkdirSync(logsDir, { recursive: true });
}

// Formato personalizado para logs
const logFormat = winston.format.combine(
	winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
	winston.format.errors({ stack: true }),
	winston.format.splat(),
	winston.format.json()
);

// Formato para consola (desarrollo) - colorizado
const consoleFormat = winston.format.combine(
	winston.format.colorize(),
	winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
	winston.format.printf(({ timestamp, level, message, ...meta }) => {
		let msg = `${timestamp} [${level}]: ${message}`;
		if (Object.keys(meta).length > 0) {
			msg += ` ${JSON.stringify(meta)}`;
		}
		return msg;
	})
);

// Transportes para desarrollo (consola colorizada)
const devTransports = [
	new winston.transports.Console({
		format: consoleFormat,
		level: 'debug',
	}),
];

// Transportes para producción (archivos rotativos)
const prodTransports = [
	// Archivo general (info y warn)
	new DailyRotateFile({
		filename: path.join(logsDir, 'app-%DATE%.log'),
		datePattern: 'YYYY-MM-DD',
		zippedArchive: true,
		maxSize: '20m',
		maxFiles: '14d',
		format: logFormat,
		level: 'info',
	}),
	// Archivo de errores (solo errores)
	new DailyRotateFile({
		filename: path.join(logsDir, 'error-%DATE%.log'),
		datePattern: 'YYYY-MM-DD',
		zippedArchive: true,
		maxSize: '20m',
		maxFiles: '30d',
		format: logFormat,
		level: 'error',
	}),
];

// Crear logger
const logger = winston.createLogger({
	level: isProduction ? 'info' : 'debug',
	format: logFormat,
	defaultMeta: { service: 'ippl-backend' },
	transports: isProduction ? prodTransports : devTransports,
	// No lanzar excepciones en producción
	exitOnError: false,
});

// Si no estamos en producción, también loguear en consola
if (!isProduction) {
	logger.add(new winston.transports.Console({
		format: consoleFormat,
	}));
}

module.exports = logger;

