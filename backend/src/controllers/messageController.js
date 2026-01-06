'use strict';

const { Message } = require('../../models');
const { toMessageDTOList } = require('../../mappers/MessageMapper');
const logger = require('../utils/logger');
const { sendSuccess, sendError } = require('../utils/response');

async function createMessage(req, res) {
  try {
    const { nombre, apellido, correoElectronico, mensaje, fecha } = req.body;

    if (!nombre || !apellido || !correoElectronico || !mensaje) {
      return sendError(res, 400, 'Faltan campos requeridos');
    }

    await Message.create({
      nombre,
      apellido,
      correoElectronico,
      mensaje,
      ...(fecha ? { fecha: new Date(fecha) } : {}),
      leido: false,
    });

    return sendSuccess(res, null, 'Mensaje enviado exitosamente', 201);
  } catch (error) {
    logger.error('Error al crear mensaje:', error);
    return sendError(res, 500, 'Error al enviar el mensaje');
  }
}

async function getAllMessages(req, res) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const leido = req.query.leido !== undefined ? req.query.leido === 'true' : undefined;
    
    if (page < 1) return sendError(res, 400, 'page debe ser mayor a 0');
    if (limit < 1 || limit > 100) return sendError(res, 400, 'limit debe estar entre 1 y 100');
    
    const offset = (page - 1) * limit;
    
    const where = {};
    if (leido !== undefined) {
      where.leido = leido;
    }
    
    const { count, rows } = await Message.findAndCountAll({
      where,
      order: [
        ['fecha', 'DESC'],
        ['createdAt', 'DESC'],
      ],
      limit,
      offset,
    });
    
    logger.debug('Mensajes obtenidos:', { count: rows.length, total: count });
    
    const totalPages = Math.ceil(count / limit);
    
    const hasPagination = req.query.page !== undefined || req.query.limit !== undefined;
    
    if (hasPagination) {
      return sendSuccess(res, {
        messages: toMessageDTOList(rows),
        pagination: {
          page,
          limit,
          total: count,
          totalPages,
        },
      });
    } else {
      return sendSuccess(res, toMessageDTOList(rows));
    }
  } catch (error) {
    logger.error('Error al obtener mensajes:', error);
    return sendError(res, 500, 'Error al obtener los mensajes');
  }
}

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
