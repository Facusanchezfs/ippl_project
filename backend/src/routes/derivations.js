const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getDerivations } = require('../controllers/derivationController');

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Rutas
router.get('/', getDerivations);

module.exports = router;

