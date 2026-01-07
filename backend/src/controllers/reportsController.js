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

    const fromStr = fromDate.toISOString().split('T')[0];
    const toStr = toDate.toISOString().split('T')[0];

    // DEBUG: Parámetros y normalización de fechas
    logger.info(`

================= MONTHLY REVENUE DEBUG (INPUT) =================
from (raw): ${from}
to   (raw): ${to}

fromDate: ${fromDate.toISOString()}    (midnight local set)
toDate  : ${toDate.toISOString()}      (23:59:59.999 local set)
today   : ${today.toISOString()}       (midnight local set)

fromStr : ${fromStr}
toStr   : ${toStr}
================================================================

`);

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

    logger.info(`

================= MONTHLY REVENUE DEBUG (APPOINTMENTS SAMPLE) ===============
count(*) en rango (con filtros): ${sampleCountRes?.[0]?.cnt ?? 'N/A'}

Top 10 filas (id, date, status, attended, sessionCost, professionalId, professionalName):
${JSON.stringify(sampleRows, null, 2)}
============================================================================

`);

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

    logger.info(`

================= MONTHLY REVENUE DEBUG (PROFESSIONALS COMMISSION) ==========
professionalIds en rango: ${JSON.stringify(proIds)}
Commissions (id, name, commission):
${JSON.stringify(prosWithCommission, null, 2)}
============================================================================

`);

    // DEBUG: SQL a ejecutar (byProfessional y total) + parámetros
    logger.info(`

================= MONTHLY REVENUE DEBUG (SQL EXEC) ==========================
SQL byProfessional:
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

SQL total:
SELECT 
  SUM(a.sessionCost * (1 - COALESCE(u.commission, 0) / 100)) as total
FROM Appointments a
LEFT JOIN Users u ON a.professionalId = u.id
WHERE a.active = true
  AND a.status = 'completed'
  AND a.attended = true
  AND a.date BETWEEN :fromDate AND :toDate
  AND a.sessionCost IS NOT NULL

Params: { fromDate: ${fromStr}, toDate: ${toStr} }
============================================================================

`);

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

    // DEBUG: Resultados de salida
    logger.info(`

================= MONTHLY REVENUE DEBUG (RESULTS) ===========================
byProfessional (count=${byProfessional.length}):
${JSON.stringify(byProfessional, null, 2)}

totalResult (raw):
${JSON.stringify(totalResult, null, 2)}

Parsed total: ${total}
============================================================================

`);

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

