'use strict';

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../controllers/authController');
const {
  previewReconcileSaldos,
  applyReconcileSaldos,
} = require('../controllers/reconcileProfessionalSaldosController');

router.use(verifyToken);

router.use((req, res, next) => {
  const role = req.user?.role;
  if (role !== 'admin' && role !== 'financial') {
    return res.status(403).json({
      success: false,
      error: 'Acceso denegado. Solo administradores o usuario financiero.',
    });
  }
  next();
});

router.get('/preview', previewReconcileSaldos);
router.post('/apply', applyReconcileSaldos);

module.exports = router;
