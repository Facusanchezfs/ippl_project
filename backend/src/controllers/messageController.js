'use strict';

const { Message } = require('../../models');
const { toMessageDTOList } = require('../../mappers/MessageMapper');
const logger = require('../utils/logger');
const { sendSuccess, sendError } = require('../utils/response');

// Create a new message
async function createMessage(req, res) {
  try {
    const { nombre, apellido, correoElectronico, mensaje, fecha } = req.body;

    // Validaciones básicas
    if (!nombre || !apellido || !correoElectronico || !mensaje) {
      return sendError(res, 400, 'Faltan campos requeridos');
    }

    await Message.create({
      nombre,
      apellido,
      correoElectronico,
      mensaje,
      // `fecha` es opcional; si no viene, el default del modelo es NOW
      ...(fecha ? { fecha: new Date(fecha) } : {}),
      leido: false,
    });

    return sendSuccess(res, null, 'Mensaje enviado exitosamente', 201);
  } catch (error) {
    logger.error('Error al crear mensaje:', error);
    return sendError(res, 500, 'Error al enviar el mensaje');
  }
}

// Get all messages (array plano)
async function getAllMessages(req, res) {
  try {
    const rows = await Message.findAll({
      order: [
        ['fecha', 'DESC'],
        ['createdAt', 'DESC'],
      ],
    });
    logger.debug('Mensajes obtenidos:', { count: rows.length });
    return sendSuccess(res, toMessageDTOList(rows));
  } catch (error) {
    logger.error('Error al obtener mensajes:', error);
    return sendError(res, 500, 'Error al obtener los mensajes');
  }
}

// Mark message as read
async function markAsRead(req, res) {
  try {
    const { id } = req.params;

    const msg = req.message || await Message.findByPk(id)
    if (!msg) {
      return sendError(res, 404, 'Mensaje no encontrado');
    }

    if (!msg.leido) {
      await msg.update({ leido: true });
    }

    return sendSuccess(res, null, 'Mensaje marcado como leído');
  } catch (error) {
    logger.error('Error al marcar mensaje como leído:', error);
    return sendError(res, 500, 'Error al actualizar el mensaje');
  }
}

async function clearAllMessages(req, res) {
  try {
    await Message.destroy({ where: {} });
    return sendSuccess(res, null, 'Todos los mensajes han sido eliminados', 204);
  } catch (error) {
    logger.error('Error al limpiar mensajes:', error);
    return sendError(res, 500, 'Error al eliminar los mensajes');
  }
}

module.exports = {
  createMessage,
  getAllMessages,
  markAsRead,
  clearAllMessages,
};
