'use strict';

const { Message } = require('../../models');
const { toMessageDTOList } = require('../../mappers/MessageMapper');
const logger = require('../utils/logger');

// Create a new message
async function createMessage(req, res) {
  try {
    const { nombre, apellido, correoElectronico, mensaje, fecha } = req.body;

    // Validaciones básicas
    if (!nombre || !apellido || !correoElectronico || !mensaje) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
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

    // Si preferís devolver el objeto creado:
    // return res.status(201).json(toMessageDTO(created));

    return res.status(201).json({ message: 'Mensaje enviado exitosamente' });
  } catch (error) {
    logger.error('Error al crear mensaje:', error);
    return res.status(500).json({ error: 'Error al enviar el mensaje' });
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
    return res.json(toMessageDTOList(rows));
  } catch (error) {
    logger.error('Error al obtener mensajes:', error);
    return res.status(500).json({ error: 'Error al obtener los mensajes' });
  }
}

// Mark message as read
async function markAsRead(req, res) {
  try {
    const { id } = req.params;

    const msg = req.message || await Message.findByPk(id)
    if (!msg) {
      return res.status(404).json({ error: 'Mensaje no encontrado' });
    }

    if (!msg.leido) {
      await msg.update({ leido: true });
    }

    return res.json({ message: 'Mensaje marcado como leído' });
  } catch (error) {
    logger.error('Error al marcar mensaje como leído:', error);
    return res.status(500).json({ error: 'Error al actualizar el mensaje' });
  }
}

async function clearAllMessages(req, res) {
  try {
    await Message.destroy({ where: {} });
    return res.json({ success: true, message: 'Todos los mensajes han sido eliminados' });
  } catch (error) {
    logger.error('Error al limpiar mensajes:', error);
    return res.status(500).json({ error: 'Error al eliminar los mensajes' });
  }
}

module.exports = {
  createMessage,
  getAllMessages,
  markAsRead,
  clearAllMessages,
};
