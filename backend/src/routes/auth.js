const express = require('express');
const router = express.Router();
const { login, refreshToken, getCurrentUser } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

router.post('/login', login);
router.post('/refresh-token', refreshToken);
router.get('/me', authenticateToken, getCurrentUser);

module.exports = router; 