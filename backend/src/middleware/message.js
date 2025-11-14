'use strict';

const { Message } = require('../../models');
const logger = require('../utils/logger');

function requireMessageManager(req, res, next) {
  const role = req.user?.role;
  if (role === 'admin' || role === 'content_manager' || role === 'financial') return next();
  return res.status(403).json({ message: 'Acceso denegado' });
}

async function loadMessageById(req, res, next) {
  try {
    const { id } = req.params;
    const msg = await Message.findByPk(id);
    if (!msg) return res.status(404).json({ message: 'Mensaje no encontrado' });
    req.message = msg;
    return next();
  } catch (err) {
    logger.error('[loadMessageById] Error:', err);
    return res.status(500).json({ message: 'Error al buscar el mensaje' });
  }
}

module.exports = { requireMessageManager, loadMessageById };
