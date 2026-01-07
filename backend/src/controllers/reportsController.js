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

    // Comparar fechas como strings YYYY-MM-DD para evitar problemas de timezone
    if (from > to) {
      return sendError(res, 400, 'La fecha from no puede ser mayor a la fecha to');
    }

    // Obtener fecha actual en formato YYYY-MM-DD (usando fecha local del servidor)
    const today = new Date();
    const todayStr = today.getFullYear() + '-' + 
                     String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                     String(today.getDate()).padStart(2, '0');

    if (to > todayStr) {
      return sendError(res, 400, 'La fecha to no puede ser mayor a la fecha actual');
    }

    // Obtener abonos del período seleccionado (filtrados por fecha del abono)
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

    // Convertir a formato esperado por el frontend
    const byProfessional = abonosInRange.map(item => ({
      professionalId: String(item.professionalId),
      professionalName: item.professionalName || 'Sin nombre',
      total: parseFloat(item.total || 0)
    }));

    // Calcular total general
    const total = byProfessional.reduce((sum, prof) => sum + prof.total, 0);

    return sendSuccess(res, {
      from,
      to,
      total: parseFloat(total.toFixed(2)),
      byProfessional,
      professionalsWithNullSessionCost: [] // No aplica para abonos, mantener por compatibilidad
    });
  } catch (error) {
    logger.error('Error al obtener ingresos mensuales:', error);
    return sendError(res, 500, 'Error al obtener ingresos mensuales');
  }
};

module.exports = {
  getMonthlyRevenue
};
