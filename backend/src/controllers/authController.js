const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User } = require('../../models');
const { toUserDTO } = require('../../mappers/UserMapper');
const { JWT_SECRET } = require('../config/jwt');
const logger = require('../utils/logger');

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
			return res.status(401).json({ message: 'Usuario no encontrado' });
		}

		const valid = await bcrypt.compare(password, user.password);
		if (!valid) {
			return res.status(401).json({ message: 'Contraseña incorrecta' });
		}

		if (user.status === 'inactive') {
			return res
				.status(403)
				.json({ message: 'Cuenta inactiva. Contacta al administrador.' });
		}

		const token = generateToken(user);
		user.lastLogin = new Date();
		await user.save();

		const userDTO = toUserDTO(user);

		res.json({ token, user: userDTO });
	} catch (err) {
		logger.error('Error en login:', err);
		res.status(500).json({ message: 'Error en el servidor' });
	}
};

const refreshToken = async (req, res) => {
	try {
		const { token } = req.body;
		if (!token) {
			return res.status(400).json({ message: 'Token no proporcionado' });
		}

		// Decodifica sin importar expiración
		const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });

		// 🔍 Busca usuario en DB
		const user = await User.findByPk(decoded.id);
		if (!user || user.status === 'inactive') {
			return res.status(403).json({ message: 'Usuario no válido o inactivo' });
		}

		// 🆕 Nuevo token
		const newToken = generateToken(user);
		res.json({ token: newToken });
	} catch (error) {
		logger.error('Error al renovar token:', error);
		const isExpired = error.name === 'TokenExpiredError';
		return res.status(401).json({
			message: isExpired ? 'Token expirado' : 'Token inválido',
			code: isExpired ? 'TOKEN_EXPIRED' : undefined,
		});
	}
};

const verifyToken = (req, res, next) => {
	const token = req.header('Authorization')?.replace('Bearer ', '');
	if (!token) {
		return res.status(401).json({ message: 'Acceso denegado' });
	}
	try {
		req.user = jwt.verify(token, JWT_SECRET);
		next();
	} catch (error) {
		const isExpired = error.name === 'TokenExpiredError';
		return res.status(401).json({
			message: isExpired ? 'Token expirado' : 'Token inválido',
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
			return res.status(401).json({ message: 'Usuario no autenticado' });
		}

		// Buscar usuario en la base de datos
		const user = await User.findByPk(req.user.id);

		if (!user) {
			return res.status(404).json({ message: 'Usuario no encontrado' });
		}

		// Verificar que el usuario esté activo
		if (user.status === 'inactive') {
			return res.status(403).json({ 
				message: 'Cuenta inactiva. Contacta al administrador.' 
			});
		}

		// Devolver usuario en formato DTO
		const userDTO = toUserDTO(user);
		return res.json({ user: userDTO });
	} catch (error) {
		logger.error('Error al obtener usuario actual:', error);
		return res.status(500).json({ message: 'Error al obtener usuario' });
	}
};

module.exports = { login, refreshToken, verifyToken, getCurrentUser };
