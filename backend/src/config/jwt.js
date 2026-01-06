/**
 * Configuración y validación de JWT
 * 
 * Este módulo centraliza la configuración del secreto JWT y valida
 * que esté presente y tenga la longitud mínima requerida.
 * 
 * El servidor NO iniciará si JWT_SECRET no está configurado correctamente.
 */

require('dotenv').config();

const MIN_SECRET_LENGTH = 32;

/**
 * Valida que JWT_SECRET esté configurado y sea seguro
 * @throws {Error} Si JWT_SECRET no está configurado o es inseguro
 */
function validateJwtSecret() {
	const secret = process.env.JWT_SECRET;

	if (!secret) {
		throw new Error(
			'❌ JWT_SECRET no está configurado. ' +
			'Por favor, configura la variable de entorno JWT_SECRET en tu archivo .env. ' +
			'El secreto debe tener al menos 32 caracteres y ser aleatorio.'
		);
	}

	if (secret.length < MIN_SECRET_LENGTH) {
		throw new Error(
			`❌ JWT_SECRET es demasiado corto (${secret.length} caracteres). ` +
			`Debe tener al menos ${MIN_SECRET_LENGTH} caracteres para ser seguro.`
		);
	}

	if (secret === 'tu_secreto_super_seguro') {
		console.warn(
			'⚠️  ADVERTENCIA: JWT_SECRET parece ser el valor por defecto inseguro. ' +
			'Por favor, cambia a un secreto aleatorio fuerte.'
		);
	}

	return secret;
}

const JWT_SECRET = validateJwtSecret();

module.exports = {
	JWT_SECRET,
	validateJwtSecret
};

