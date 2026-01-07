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

    const fromStr = from;
    const toStr = to;

    // PASO 1: Obtener appointments por fecha (con filtros)
    const appointmentsInRange = await sequelize.query(`
      SELECT 
        a.id,
        a.date,
        a.professionalId,
        a.professionalName,
        a.sessionCost
      FROM Appointments a
      WHERE a.active = true
        AND a.status = 'completed'
        AND a.attended = true
        AND a.date BETWEEN :fromDate AND :toDate
        AND a.sessionCost IS NOT NULL
        AND a.professionalId IS NOT NULL
      ORDER BY a.date ASC, a.id ASC
    `, {
      replacements: { fromDate: fromStr, toDate: toStr },
      type: Sequelize.QueryTypes.SELECT
    });

    // PASO 2: Obtener todos los profesionales
    const allProfessionals = await sequelize.query(`
      SELECT 
        u.id,
        u.name,
        u.commission
      FROM Users u
      WHERE u.role = 'professional'
      ORDER BY u.name ASC
    `, {
      type: Sequelize.QueryTypes.SELECT
    });

    // PASO 3: Crear mapa de profesionales por ID para acceso rápido
    const professionalsMap = {};
    allProfessionals.forEach(prof => {
      professionalsMap[prof.id] = prof;
    });

    // PASO 4: Calcular ingreso por appointment y detectar profesionales con sessionCost NULL
    const professionalsWithNullSessionCost = new Set();
    
    // Buscar appointments con sessionCost NULL (para reportarlos)
    const appointmentsWithNullSessionCost = await sequelize.query(`
      SELECT DISTINCT
        a.professionalId,
        a.professionalName,
        u.name as user_name
      FROM Appointments a
      LEFT JOIN Users u ON a.professionalId = u.id
      WHERE a.active = true
        AND a.status = 'completed'
        AND a.attended = true
        AND a.date BETWEEN :fromDate AND :toDate
        AND a.sessionCost IS NULL
        AND a.professionalId IS NOT NULL
    `, {
      replacements: { fromDate: fromStr, toDate: toStr },
      type: Sequelize.QueryTypes.SELECT
    });

    appointmentsWithNullSessionCost.forEach(apt => {
      const name = apt.user_name || apt.professionalName || 'Sin nombre';
      professionalsWithNullSessionCost.add(name);
    });

    // PASO 5: Agrupar por profesional y calcular totales
    const revenueByProfessional = {};

    appointmentsInRange.forEach(apt => {
      const profId = apt.professionalId;
      const prof = professionalsMap[profId];

      if (!prof) {
        return; // Ignorar si no existe el profesional
      }

      const sessionCost = parseFloat(apt.sessionCost || 0);
      const commission = parseFloat(prof.commission || 0);
      const instituteRevenue = sessionCost * (1 - commission / 100);

      if (!revenueByProfessional[profId]) {
        revenueByProfessional[profId] = {
          professionalId: profId,
          professionalName: prof.name,
          total: 0
        };
      }

      revenueByProfessional[profId].total += instituteRevenue;
    });

    // Convertir a array y ordenar
    const byProfessional = Object.values(revenueByProfessional)
      .map(prof => ({
        professionalId: String(prof.professionalId),
        professionalName: prof.professionalName,
        total: parseFloat(prof.total.toFixed(2))
      }))
      .sort((a, b) => a.professionalName.localeCompare(b.professionalName));

    // PASO 6: Calcular total general
    const total = byProfessional.reduce((sum, prof) => sum + prof.total, 0);

    return sendSuccess(res, {
      from,
      to,
      total: parseFloat(total.toFixed(2)),
      byProfessional,
      professionalsWithNullSessionCost: Array.from(professionalsWithNullSessionCost).sort()
    });
  } catch (error) {
    logger.error('Error al obtener ingresos mensuales:', error);
    return sendError(res, 500, 'Error al obtener ingresos mensuales');
  }
};

module.exports = {
  getMonthlyRevenue
};
