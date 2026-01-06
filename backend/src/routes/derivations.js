const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getDerivations } = require('../controllers/derivationController');

router.use(authenticateToken);

router.get('/', getDerivations);

module.exports = router;

