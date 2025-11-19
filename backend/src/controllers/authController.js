const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User } = require('../../models');
const { toUserDTO } = require('../../mappers/UserMapper');
const { JWT_SECRET } = require('../config/jwt');
const logger = require('../utils/logger');
const { sendError } = require('../utils/response');

const generateToken = (user) => {
	return jwt.sign(
		{
			id: user.id,
			role: user.role,
			email: user.email,
			name: user.name,
			status: user.status,
		},
		JWT_SECRET,
		{ expiresIn: '7d' }
	);
};

const login = async (req, res) => {
	try {
		const { username, password } = req.body;

		const user = await User.findOne({
			where: { email: username },
		});

		if (!user) {
			return sendError(res, 401, 'Usuario no encontrado');
		}

		const valid = await bcrypt.compare(password, user.password);
		if (!valid) {
			return sendError(res, 401, 'Contraseña incorrecta');
		}

		if (user.status === 'inactive') {
			return sendError(res, 403, 'Cuenta inactiva. Contacta al administrador.');
		}

		const token = generateToken(user);
		user.lastLogin = new Date();
		await user.save();

		const userDTO = toUserDTO(user);

		res.json({ token, user: userDTO });
	} catch (err) {
		logger.error('Error en login:', err);
		return sendError(res, 500, 'Error en el servidor');
	}
};

const refreshToken = async (req, res) => {
	try {
		const { token } = req.body;
		if (!token) {
			return sendError(res, 400, 'Token no proporcionado');
		}

		// Decodifica sin importar expiración
		const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });

		// 🔍 Busca usuario en DB
		const user = await User.findByPk(decoded.id);
		if (!user || user.status === 'inactive') {
			return sendError(res, 403, 'Usuario no válido o inactivo');
		}

		// 🆕 Nuevo token
		const newToken = generateToken(user);
		res.json({ token: newToken });
	} catch (error) {
		logger.error('Error al renovar token:', error);
		const isExpired = error.name === 'TokenExpiredError';
		return sendError(res, 401, isExpired ? 'Token expirado' : 'Token inválido', {
			code: isExpired ? 'TOKEN_EXPIRED' : undefined,
		});
	}
};

const verifyToken = (req, res, next) => {
	const token = req.header('Authorization')?.replace('Bearer ', '');
	if (!token) {
		return sendError(res, 401, 'Acceso denegado');
	}
	try {
		req.user = jwt.verify(token, JWT_SECRET);
		next();
	} catch (error) {
		const isExpired = error.name === 'TokenExpiredError';
		return sendError(res, 401, isExpired ? 'Token expirado' : 'Token inválido', {
			code: isExpired ? 'TOKEN_EXPIRED' : undefined,
		});
	}
};

/**
 * Obtiene el usuario actual autenticado
 * Requiere token válido en el header Authorization
 */
const getCurrentUser = async (req, res) => {
	try {
		// req.user viene del middleware authenticateToken
		if (!req.user || !req.user.id) {
			return sendError(res, 401, 'Usuario no autenticado');
		}

		// Buscar usuario en la base de datos
		const user = await User.findByPk(req.user.id);

		if (!user) {
			return sendError(res, 404, 'Usuario no encontrado');
		}

		// Verificar que el usuario esté activo
		if (user.status === 'inactive') {
			return sendError(res, 403, 'Cuenta inactiva. Contacta al administrador.');
		}

		// Devolver usuario en formato DTO (mantener formato { user } para compatibilidad con frontend)
		const userDTO = toUserDTO(user);
		return res.json({ user: userDTO });
	} catch (error) {
		logger.error('Error al obtener usuario actual:', error);
		return sendError(res, 500, 'Error al obtener usuario');
	}
};

module.exports = { login, refreshToken, verifyToken, getCurrentUser };
