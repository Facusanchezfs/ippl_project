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
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (fromDate > toDate) {
      return sendError(res, 400, 'La fecha from no puede ser mayor a la fecha to');
    }

    toDate.setHours(23, 59, 59, 999);
    if (toDate > today) {
      return sendError(res, 400, 'La fecha to no puede ser mayor a la fecha actual');
    }

    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);

    const fromStr = from; // usar directamente YYYY-MM-DD recibido
    const toStr = to;     // evitar shift por toISOString()/UTC

    // DEBUG: Muestreo de citas en rango (para validar filtros/fechas/montos)
    const sampleRows = await sequelize.query(`
      SELECT a.id, a.date, a.status, a.attended, a.sessionCost, a.professionalId, a.professionalName
      FROM Appointments a
      WHERE a.active = true
        AND a.status = 'completed'
        AND a.attended = true
        AND a.date BETWEEN :fromDate AND :toDate
        AND a.sessionCost IS NOT NULL
      ORDER BY a.date ASC, a.id ASC
      LIMIT 10
    `, { replacements: { fromDate: fromStr, toDate: toStr }, type: Sequelize.QueryTypes.SELECT });

    const sampleCountRes = await sequelize.query(`
      SELECT COUNT(*) as cnt
      FROM Appointments a
      WHERE a.active = true
        AND a.status = 'completed'
        AND a.attended = true
        AND a.date BETWEEN :fromDate AND :toDate
        AND a.sessionCost IS NOT NULL
    `, { replacements: { fromDate: fromStr, toDate: toStr }, type: Sequelize.QueryTypes.SELECT });

    // DEBUG: Profesionales y sus comisiones involucradas
    const prosInRange = await sequelize.query(`
      SELECT DISTINCT a.professionalId
      FROM Appointments a
      WHERE a.active = true
        AND a.status = 'completed'
        AND a.attended = true
        AND a.date BETWEEN :fromDate AND :toDate
        AND a.sessionCost IS NOT NULL
        AND a.professionalId IS NOT NULL
    `, { replacements: { fromDate: fromStr, toDate: toStr }, type: Sequelize.QueryTypes.SELECT });

    const proIds = prosInRange.map(r => r.professionalId).filter(Boolean);

    let prosWithCommission = [];
    if (proIds.length > 0) {
      prosWithCommission = await sequelize.query(`
        SELECT u.id, u.name, u.commission
        FROM Users u
        WHERE u.id IN (${proIds.map(() => '?').join(',')})
      `, { replacements: proIds, type: Sequelize.QueryTypes.SELECT });
    }

    const revenueByProfessional = await sequelize.query(`
      SELECT 
        a.professionalId,
        MAX(u.name) as professionalName,
        SUM(a.sessionCost * (1 - COALESCE(u.commission, 0) / 100)) as total
      FROM Appointments a
      LEFT JOIN Users u ON a.professionalId = u.id
      WHERE a.active = true
        AND a.status = 'completed'
        AND a.attended = true
        AND a.date BETWEEN :fromDate AND :toDate
        AND a.sessionCost IS NOT NULL
      GROUP BY a.professionalId
      ORDER BY professionalName ASC
    `, {
      replacements: { fromDate: fromStr, toDate: toStr },
      type: Sequelize.QueryTypes.SELECT
    });

    const totalResult = await sequelize.query(`
      SELECT 
        SUM(a.sessionCost * (1 - COALESCE(u.commission, 0) / 100)) as total
      FROM Appointments a
      LEFT JOIN Users u ON a.professionalId = u.id
      WHERE a.active = true
        AND a.status = 'completed'
        AND a.attended = true
        AND a.date BETWEEN :fromDate AND :toDate
        AND a.sessionCost IS NOT NULL
    `, {
      replacements: { fromDate: fromStr, toDate: toStr },
      type: Sequelize.QueryTypes.SELECT
    });

    const total = parseFloat(totalResult[0]?.total || 0);

    const byProfessional = revenueByProfessional.map(row => ({
      professionalId: String(row.professionalId || ''),
      professionalName: row.professionalName || 'Sin profesional',
      total: parseFloat(row.total || 0)
    }));

    const debugInfo = {
      input: {
        fromRaw: from,
        toRaw: to,
        fromDate: fromDate.toISOString(),
        toDate: toDate.toISOString(),
        today: today.toISOString(),
        fromStr,
        toStr
      },
      appointmentsSample: {
        count: sampleCountRes?.[0]?.cnt ?? 0,
        sampleRows: sampleRows || []
      },
      professionalsCommission: {
        professionalIds: proIds,
        professionals: prosWithCommission || []
      },
      sqlQueries: {
        byProfessional: `
          SELECT 
            a.professionalId,
            MAX(u.name) as professionalName,
            SUM(a.sessionCost * (1 - COALESCE(u.commission, 0) / 100)) as total
          FROM Appointments a
          LEFT JOIN Users u ON a.professionalId = u.id
          WHERE a.active = true
            AND a.status = 'completed'
            AND a.attended = true
            AND a.date BETWEEN :fromDate AND :toDate
            AND a.sessionCost IS NOT NULL
          GROUP BY a.professionalId
          ORDER BY professionalName ASC
        `,
        total: `
          SELECT 
            SUM(a.sessionCost * (1 - COALESCE(u.commission, 0) / 100)) as total
          FROM Appointments a
          LEFT JOIN Users u ON a.professionalId = u.id
          WHERE a.active = true
            AND a.status = 'completed'
            AND a.attended = true
            AND a.date BETWEEN :fromDate AND :toDate
            AND a.sessionCost IS NOT NULL
        `,
        params: { fromDate: fromStr, toDate: toStr }
      },
      results: {
        revenueByProfessionalRaw: revenueByProfessional || [],
        totalResultRaw: totalResult || [],
        parsedTotal: total,
        byProfessionalFinal: byProfessional || []
      }
    };

    return sendSuccess(res, {
      from,
      to,
      total,
      byProfessional,
      debug: debugInfo
    });
  } catch (error) {
    logger.error('Error al obtener ingresos mensuales:', error);
    return sendError(res, 500, 'Error al obtener ingresos mensuales');
  }
};

module.exports = {
  getMonthlyRevenue
};

