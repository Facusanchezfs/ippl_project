const express = require('express');
const router = express.Router();
const { login, refreshToken, getCurrentUser } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimiter');

router.post('/login', loginLimiter, login);
router.post('/refresh-token', refreshToken);
router.get('/me', authenticateToken, getCurrentUser);

module.exports = router; 