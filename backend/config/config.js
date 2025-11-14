'use strict';
require('dotenv').config();

/**
 * Valida que una variable de entorno esté configurada
 * @param {string} varName - Nombre de la variable de entorno
 * @param {string} envName - Nombre del entorno (development/test/production)
 * @throws {Error} Si la variable no está configurada
 */
function requireEnv(varName, envName) {
	const value = process.env[varName];
	if (!value) {
		throw new Error(
			`❌ ${varName} no está configurado para el entorno ${envName}. ` +
			`Por favor, configura esta variable de entorno en tu archivo .env`
		);
	}
	return value;
}

module.exports = {
	development: {
		username: process.env.DB_USER || 'root',
		password: process.env.DB_PASS || 'root1234',
		database: process.env.DB_NAME || 'ippl_db',
		host: process.env.DB_HOST || '127.0.0.1',
		port: process.env.DB_PORT || 3306,
		dialect: 'mysql',
	},
	test: {
		username: process.env.DB_USER || 'root',
		password: process.env.DB_PASS || null,
		database: process.env.DB_TEST_NAME || 'database_test',
		host: process.env.DB_HOST || '127.0.0.1',
		port: process.env.DB_PORT || 3306,
		dialect: 'mysql',
	},
	production: {
		// En producción, todas las variables son OBLIGATORIAS
		// Solo validar si realmente estamos en producción
		username: process.env.NODE_ENV === 'production' 
			? requireEnv('DB_USER_PROD', 'production')
			: (process.env.DB_USER_PROD || 'root'),
		password: process.env.NODE_ENV === 'production'
			? requireEnv('DB_PASS_PROD', 'production')
			: (process.env.DB_PASS_PROD || 'root1234'),
		database: process.env.NODE_ENV === 'production'
			? requireEnv('DB_NAME_PROD', 'production')
			: (process.env.DB_NAME_PROD || 'ippl_db'),
		host: process.env.NODE_ENV === 'production'
			? requireEnv('DB_HOST_PROD', 'production')
			: (process.env.DB_HOST_PROD || '127.0.0.1'),
		port: process.env.DB_PORT_PROD || 3306,
		dialect: 'mysql',
	},
};