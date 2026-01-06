const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

const isProduction = process.env.NODE_ENV === 'production';
const logsDir = path.join(__dirname, '../../logs');

if (!fs.existsSync(logsDir)) {
	fs.mkdirSync(logsDir, { recursive: true });
}

const logFormat = winston.format.combine(
	winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
	winston.format.errors({ stack: true }),
	winston.format.splat(),
	winston.format.json()
);

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

const devTransports = [
	new winston.transports.Console({
		format: consoleFormat,
		level: 'debug',
	}),
];

const prodTransports = [
	new DailyRotateFile({
		filename: path.join(logsDir, 'app-%DATE%.log'),
		datePattern: 'YYYY-MM-DD',
		zippedArchive: true,
		maxSize: '20m',
		maxFiles: '14d',
		format: logFormat,
		level: 'info',
	}),
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

const logger = winston.createLogger({
	level: isProduction ? 'info' : 'debug',
	format: logFormat,
	defaultMeta: { service: 'ippl-backend' },
	transports: isProduction ? prodTransports : devTransports,
	exitOnError: false,
});

if (!isProduction) {
	logger.add(new winston.transports.Console({
		format: consoleFormat,
	}));
}

module.exports = logger;

