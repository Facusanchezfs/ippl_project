const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwt');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No se proporcionó token de acceso' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Tu sesión ha expirado', 
        code: 'TOKEN_EXPIRED',
        expiredAt: error.expiredAt 
      });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ 
        error: 'Token inválido', 
        code: 'INVALID_TOKEN' 
      });
    } else {
    console.error('Error al verificar token:', error);
      return res.status(403).json({ 
        error: 'Error al verificar el token', 
        code: 'TOKEN_ERROR' 
      });
    }
  }
};

const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    console.log('User role:', req.user.role);
    console.log('Allowed roles:', allowedRoles);

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'No tienes permiso para acceder a este recurso' });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  checkRole
}; 