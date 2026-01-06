
const { Op, fn, col } = require('sequelize');
const { sequelize, User, Patient, Post, Appointment } = require('../../models');
const logger = require('../utils/logger');
const { sendSuccess, sendError } = require('../utils/response');

const getSystemStats = async (req, res) => {
  try {
    const now = new Date();
    
    const usersAgg = await User.findAll({
      attributes: [
        [fn('COUNT', col('id')), 'total'],
        [fn('SUM', sequelize.literal(`CASE WHEN status = 'active' THEN 1 ELSE 0 END`)), 'active'],
        [fn('SUM', sequelize.literal(`CASE WHEN role = 'admin' THEN 1 ELSE 0 END`)), 'admin'],
        [fn('SUM', sequelize.literal(`CASE WHEN role = 'professional' THEN 1 ELSE 0 END`)), 'professional'],
        [fn('SUM', sequelize.literal(`CASE WHEN role = 'content_manager' THEN 1 ELSE 0 END`)), 'content_manager'],
      ],
      raw: true,
      limit: 1,
    });
    const usersData = usersAgg[0] || {};
    const totalUsers = parseInt(usersData.total || 0, 10);
    const activeUsers = parseInt(usersData.active || 0, 10);
    const admins = parseInt(usersData.admin || 0, 10);
    const pros = parseInt(usersData.professional || 0, 10);
    const cms = parseInt(usersData.content_manager || 0, 10);

    const patientsAgg = await Patient.findAll({
      attributes: [
        [fn('COUNT', col('id')), 'total'],
        [fn('SUM', sequelize.literal(`CASE WHEN status = 'active' THEN 1 ELSE 0 END`)), 'active'],
      ],
      where: { active: true },
      raw: true,
      limit: 1,
    });
    const patientsData = patientsAgg[0] || {};
    const totalPatients = parseInt(patientsData.total || 0, 10);
    const activePatients = parseInt(patientsData.active || 0, 10);

    const patientsWithUpcoming = await Appointment.findAll({
      attributes: [[fn('DISTINCT', col('patientId')), 'patientId']],
      where: {
        active: true,
        status: 'scheduled',
        [Op.and]: [
          sequelize.where(fn('TIMESTAMP', col('date'), col('startTime')), { [Op.gt]: now }),
        ],
      },
      raw: true,
    });

    const byProfessionalRows = await Patient.findAll({
      attributes: ['professionalId', [fn('COUNT', col('id')), 'count']],
      where: { active: true, professionalId: { [Op.ne]: null } },
      group: ['professionalId'],
      raw: true,
    });
    const byProfessional = {};
    for (const r of byProfessionalRows) {
      byProfessional[String(r.professionalId)] = parseInt(r.count, 10);
    }

    const postsAgg = await Post.findAll({
      attributes: [
        [fn('COUNT', col('id')), 'total'],
        [fn('SUM', sequelize.literal(`CASE WHEN status = 'published' THEN 1 ELSE 0 END`)), 'published'],
        [fn('SUM', col('views')), 'totalViews'],
        [fn('SUM', col('likes')), 'totalLikes'],
      ],
      where: { active: true },
      raw: true,
      limit: 1,
    });
    const postsData = postsAgg[0] || {};
    const totalPosts = parseInt(postsData.total || 0, 10);
    const publishedPosts = parseInt(postsData.published || 0, 10);
    const totalViews = parseInt(postsData.totalViews || 0, 10);
    const totalLikes = parseInt(postsData.totalLikes || 0, 10);
    
    const bySectionRows = await Post.findAll({
      attributes: ['section', [fn('COUNT', col('id')), 'count']],
      where: { active: true },
      group: ['section'],
      raw: true,
    });
    const bySection = {};
    for (const r of bySectionRows) {
      bySection[r.section] = parseInt(r.count, 10);
    }

    const [upcomingAppointments, completedAppointments] = await Promise.all([
      Appointment.count({
        where: {
          active: true,
          status: 'scheduled',
          [Op.and]: [
            sequelize.where(fn('TIMESTAMP', col('date'), col('startTime')), { [Op.gt]: now }),
          ],
        },
      }),
      Appointment.count({
        where: { active: true, status: 'completed' },
      }),
    ]);

    return sendSuccess(res, {
      users: {
        total: totalUsers,
        byRole: { admin: admins, professional: pros, content_manager: cms },
        active: activeUsers,
      },
      patients: {
        total: totalPatients,
        active: activePatients,
        withAppointments: patientsWithUpcoming.length,
        byProfessional,
      },
      posts: {
        total: totalPosts,
        published: publishedPosts,
        totalViews,
        totalLikes,
        bySection,
      },
      appointments: {
        upcoming: upcomingAppointments,
        completed: completedAppointments,
      },
    });
  } catch (error) {
    logger.error('Error al obtener estadísticas:', error);
    return sendError(res, 500, 'Error al obtener estadísticas del sistema');
  }
};

const getProfessionalStats = async (req, res) => {
  try {
    const { professionalId } = req.params;
    const now = new Date();

    const [total, activeCount] = await Promise.all([
      Patient.count({ where: { active: true, professionalId } }),
      Patient.count({ where: { active: true, professionalId, status: 'active' } }),
    ]);

    const withUpcomingRows = await Appointment.findAll({
      attributes: [[fn('DISTINCT', col('patientId')), 'patientId']],
      where: {
        active: true,
        professionalId,
        status: 'scheduled',
        [Op.and]: [
          sequelize.where(fn('TIMESTAMP', col('date'), col('startTime')), { [Op.gt]: now }),
        ],
      },
      raw: true,
    });

    const [completed, upcoming] = await Promise.all([
      Appointment.count({
        where: { active: true, professionalId, status: 'completed' },
      }),
      Appointment.count({
        where: {
          active: true,
          professionalId,
          status: 'scheduled',
          [Op.and]: [
            sequelize.where(fn('TIMESTAMP', col('date'), col('startTime')), { [Op.gt]: now }),
          ],
        },
      }),
    ]);

    const [notesTotal, notesAudio] = await Promise.all([
      Appointment.count({
        where: {
          active: true,
          professionalId,
          notes: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] },
        },
      }),
      Appointment.count({
        where: { active: true, professionalId, audioNote: { [Op.ne]: null } },
      }),
    ]);

    return sendSuccess(res, {
      patients: {
        total,
        active: activeCount,
        withUpcomingAppointments: withUpcomingRows.length,
      },
      appointments: {
        completed,
        upcoming,
      },
      notes: {
        total: notesTotal,
        audio: notesAudio,
      },
    });
  } catch (error) {
    logger.error('Error al obtener estadísticas del profesional:', error);
    return sendError(res, 500, 'Error al obtener estadísticas del profesional');
  }
};

module.exports = {
  getSystemStats,
  getProfessionalStats
}; 