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

    // DEBUG: TODAS las citas en rango (para validar filtros/fechas/montos)
    const allAppointmentsInRange = await sequelize.query(`
      SELECT a.id, a.date, a.status, a.attended, a.sessionCost, a.professionalId, a.professionalName, u.commission
      FROM Appointments a
      LEFT JOIN Users u ON a.professionalId = u.id
      WHERE a.active = true
        AND a.status = 'completed'
        AND a.attended = true
        AND a.date BETWEEN :fromDate AND :toDate
        AND a.sessionCost IS NOT NULL
      ORDER BY a.date ASC, a.id ASC
    `, { replacements: { fromDate: fromStr, toDate: toStr }, type: Sequelize.QueryTypes.SELECT });

    // DEBUG: Buscar profesionales mencionados en la imagen esperada
    const expectedProfessionals = ['Julieta Basgall', 'Florencia Richard', 'Juliana Badano', 'Pablo Reto'];
    
    // Buscar citas de esos profesionales SIN filtros (para ver qué está pasando)
    const appointmentsWithExpectedNamesUnfiltered = await sequelize.query(`
      SELECT a.id, a.date, a.status, a.attended, a.sessionCost, a.professionalId, a.professionalName, u.commission, u.name as user_name, a.active
      FROM Appointments a
      LEFT JOIN Users u ON a.professionalId = u.id
      WHERE a.date BETWEEN :fromDate AND :toDate
        AND (
          a.professionalName LIKE '%Julieta%' OR a.professionalName LIKE '%Basgall%'
          OR a.professionalName LIKE '%Florencia%' OR a.professionalName LIKE '%Richard%'
          OR a.professionalName LIKE '%Juliana%' OR a.professionalName LIKE '%Badano%'
          OR a.professionalName LIKE '%Pablo%' OR a.professionalName LIKE '%Reto%'
          OR u.name LIKE '%Julieta%' OR u.name LIKE '%Basgall%'
          OR u.name LIKE '%Florencia%' OR u.name LIKE '%Richard%'
          OR u.name LIKE '%Juliana%' OR u.name LIKE '%Badano%'
          OR u.name LIKE '%Pablo%' OR u.name LIKE '%Reto%'
        )
      ORDER BY a.date ASC, a.id ASC
    `, { replacements: { fromDate: fromStr, toDate: toStr }, type: Sequelize.QueryTypes.SELECT });

    // Buscar citas de esos profesionales CON filtros (como en la query principal)
    const appointmentsWithExpectedNames = await sequelize.query(`
      SELECT a.id, a.date, a.status, a.attended, a.sessionCost, a.professionalId, a.professionalName, u.commission, u.name as user_name
      FROM Appointments a
      LEFT JOIN Users u ON a.professionalId = u.id
      WHERE a.active = true
        AND a.status = 'completed'
        AND a.attended = true
        AND a.date BETWEEN :fromDate AND :toDate
        AND a.sessionCost IS NOT NULL
        AND (
          a.professionalName LIKE '%Julieta%' OR a.professionalName LIKE '%Basgall%'
          OR a.professionalName LIKE '%Florencia%' OR a.professionalName LIKE '%Richard%'
          OR a.professionalName LIKE '%Juliana%' OR a.professionalName LIKE '%Badano%'
          OR a.professionalName LIKE '%Pablo%' OR a.professionalName LIKE '%Reto%'
          OR u.name LIKE '%Julieta%' OR u.name LIKE '%Basgall%'
          OR u.name LIKE '%Florencia%' OR u.name LIKE '%Richard%'
          OR u.name LIKE '%Juliana%' OR u.name LIKE '%Badano%'
          OR u.name LIKE '%Pablo%' OR u.name LIKE '%Reto%'
        )
      ORDER BY a.date ASC, a.id ASC
    `, { replacements: { fromDate: fromStr, toDate: toStr }, type: Sequelize.QueryTypes.SELECT });

    // Buscar TODOS los profesionales que tienen citas en ese rango (sin filtros de status/attended)
    const allProfessionalsInRangeUnfiltered = await sequelize.query(`
      SELECT DISTINCT a.professionalId, a.professionalName, u.name as user_name, u.commission
      FROM Appointments a
      LEFT JOIN Users u ON a.professionalId = u.id
      WHERE a.date BETWEEN :fromDate AND :toDate
        AND a.professionalId IS NOT NULL
      ORDER BY a.professionalName ASC, u.name ASC
    `, { replacements: { fromDate: fromStr, toDate: toStr }, type: Sequelize.QueryTypes.SELECT });

    // DEBUG: Muestreo de citas (primeras 10 para no saturar)
    const sampleRows = allAppointmentsInRange.slice(0, 10);

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
        sampleRows: sampleRows || [],
        allAppointments: allAppointmentsInRange || []
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
      },
      missingProfessionals: {
        expectedNames: expectedProfessionals,
        foundAppointments: appointmentsWithExpectedNames || [],
        foundAppointmentsUnfiltered: appointmentsWithExpectedNamesUnfiltered || [],
        allProfessionalsInRangeUnfiltered: allProfessionalsInRangeUnfiltered || []
      },
      calculationVerification: {
        manualCalculationByProfessional: (() => {
          const manualCalc = {};
          allAppointmentsInRange.forEach(apt => {
            const profId = apt.professionalId;
            const profName = apt.professionalName || 'Sin profesional';
            const sessionCost = parseFloat(apt.sessionCost || 0);
            const commission = parseFloat(apt.commission || 0);
            const instituteRevenue = sessionCost * (1 - commission / 100);
            
            if (!manualCalc[profId]) {
              manualCalc[profId] = {
                professionalId: profId,
                professionalName: profName,
                appointments: [],
                totalSessionCost: 0,
                totalInstituteRevenue: 0
              };
            }
            
            manualCalc[profId].appointments.push({
              id: apt.id,
              date: apt.date,
              sessionCost,
              commission,
              instituteRevenue
            });
            manualCalc[profId].totalSessionCost += sessionCost;
            manualCalc[profId].totalInstituteRevenue += instituteRevenue;
          });
          
          return Object.values(manualCalc).map(prof => ({
            professionalId: prof.professionalId,
            professionalName: prof.professionalName,
            appointmentCount: prof.appointments.length,
            totalSessionCost: prof.totalSessionCost,
            totalInstituteRevenue: prof.totalInstituteRevenue
          }));
        })()
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

