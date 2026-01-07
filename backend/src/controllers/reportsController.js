const { Op, fn, col, literal } = require('sequelize');
const { sequelize, Appointment, User } = require('../../models');
const logger = require('../utils/logger');
const { sendSuccess, sendError } = require('../utils/response');

const getMonthlyRevenue = async (req, res) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return sendError(res, 400, 'Los parámetros from y to son requeridos');
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(from) || !dateRegex.test(to)) {
      return sendError(res, 400, 'Las fechas deben estar en formato YYYY-MM-DD');
    }
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const today = new Date();
    today.setHours(23, 59, 59, 999);    

    if (fromDate > toDate) {
      return sendError(res, 400, 'La fecha from no puede ser mayor a la fecha to');
    }

    toDate.setHours(23, 59, 59, 999);
    if (toDate > today) {
      return sendError(res, 400, 'La fecha to no puede ser mayor a la fecha actual');
    }

    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);

    const revenueByProfessional = await Appointment.findAll({
      attributes: [
        [col('Appointments.professionalId'), 'professionalId'],
        [col('Appointments.professionalName'), 'professionalName'],
        [fn('SUM', literal('Appointments.sessionCost * (1 - COALESCE(professional.commission, 0) / 100)')), 'total']
      ],
      include: [{
        model: User,
        as: 'professional',
        attributes: [],
        required: false
      }],
      where: {
        active: true,
        status: 'completed',
        attended: true,
        date: {
          [Op.between]: [fromDate, toDate]
        },
        sessionCost: {
          [Op.ne]: null
        }
      },
      group: [col('Appointments.professionalId'), col('Appointments.professionalName')],
      raw: true
    });

    const totalResult = await Appointment.findOne({
      attributes: [
        [fn('SUM', literal('Appointments.sessionCost * (1 - COALESCE(professional.commission, 0) / 100)')), 'total']
      ],
      include: [{
        model: User,
        as: 'professional',
        attributes: [],
        required: false
      }],
      where: {
        active: true,
        status: 'completed',
        attended: true,
        date: {
          [Op.between]: [fromDate, toDate]
        },
        sessionCost: {
          [Op.ne]: null
        }
      },
      raw: true
    });

    const total = parseFloat(totalResult?.total || 0);

    const byProfessional = revenueByProfessional
      .map(row => ({
        professionalId: String(row.professionalId || ''),
        professionalName: row.professionalName || 'Sin profesional',
        total: parseFloat(row.total || 0)
      }))
      .sort((a, b) => a.professionalName.localeCompare(b.professionalName));

    return sendSuccess(res, {
      from,
      to,
      total,
      byProfessional
    });
  } catch (error) {
    logger.error('Error al obtener ingresos mensuales:', error);
    return sendError(res, 500, 'Error al obtener ingresos mensuales');
  }
};

module.exports = {
  getMonthlyRevenue
};

