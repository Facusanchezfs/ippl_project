const { Sequelize } = require('sequelize');
const { sequelize } = require('../../models');
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

    if (from > to) {
      return sendError(res, 400, 'La fecha from no puede ser mayor a la fecha to');
    }

    const today = new Date();
    const todayStr = today.getFullYear() + '-' + 
                     String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                     String(today.getDate()).padStart(2, '0');

    if (to > todayStr) {
      return sendError(res, 400, 'La fecha to no puede ser mayor a la fecha actual');
    }

    const abonosInRange = await sequelize.query(`
      SELECT 
        ab.professionalId,
        ab.professionalName,
        SUM(ab.amount) as total
      FROM Abonos ab
      WHERE DATE(ab.date) BETWEEN :fromDate AND :toDate
        AND ab.professionalId IS NOT NULL
      GROUP BY ab.professionalId, ab.professionalName
      ORDER BY ab.professionalName ASC
    `, {
      replacements: { fromDate: from, toDate: to },
      type: Sequelize.QueryTypes.SELECT
    });

    const byProfessional = abonosInRange.map(item => ({
      professionalId: String(item.professionalId),
      professionalName: item.professionalName || 'Sin nombre',
      total: parseFloat(item.total || 0)
    }));

    const total = byProfessional.reduce((sum, prof) => sum + prof.total, 0);

    return sendSuccess(res, {
      from,
      to,
      total: parseFloat(total.toFixed(2)),
      byProfessional,
      professionalsWithNullSessionCost: []
    });
  } catch (error) {
    logger.error('Error al obtener ingresos mensuales:', error);
    return sendError(res, 500, 'Error al obtener ingresos mensuales');
  }
};

module.exports = {
  getMonthlyRevenue
};
