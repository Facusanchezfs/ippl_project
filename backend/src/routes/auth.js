const express = require('express');
const router = express.Router();
const { login, refreshToken, getCurrentUser } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const { login: loginValidator, refreshToken: refreshTokenValidator } = require('../validators/authValidator');

router.post('/login', loginLimiter, validate(loginValidator), login);
router.post('/refresh-token', validate(refreshTokenValidator), refreshToken);
router.get('/me', authenticateToken, getCurrentUser);

module.exports = router; 