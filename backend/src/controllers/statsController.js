
const { Op, fn, col } = require('sequelize');
const { sequelize, User, Patient, Post, Appointment } = require('../../models');
const logger = require('../utils/logger');

const getSystemStats = async (req, res) => {
  try {
    // ---- Users ----
    const [totalUsers, activeUsers, admins, pros, cms] = await Promise.all([
      User.count(),
      User.count({ where: { status: 'active' } }),
      User.count({ where: { role: 'admin' } }),
      User.count({ where: { role: 'professional' } }),
      User.count({ where: { role: 'content_manager' } }),
    ]);

    // ---- Patients ----
    const [totalPatients, activePatients] = await Promise.all([
      // contamos solo activos (soft-delete = active: true)
      Patient.count({ where: { active: true } }),
      Patient.count({ where: { active: true, status: 'active' } }),
    ]);

    // Pacientes con cita próxima (scheduled y en el futuro)
    const now = new Date();
    const patientsWithUpcoming = await Appointment.findAll({
      attributes: [[fn('DISTINCT', col('patientId')), 'patientId']],
      where: {
        active: true,
        status: 'scheduled',
        [Op.and]: [
          // MySQL/MariaDB: fecha+hora > now
          sequelize.where(fn('TIMESTAMP', col('date'), col('startTime')), { [Op.gt]: now }),
        ],
      },
      raw: true,
    });

    // Pacientes por profesional (mapa { [professionalId]: count })
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

    // ---- Posts ----
    const [totalPosts, publishedPosts, viewsAgg, likesAgg, bySectionRows] = await Promise.all([
      Post.count({ where: { active: true } }),
      Post.count({ where: { active: true, status: 'published' } }),
      Post.findAll({
        attributes: [[fn('SUM', col('views')), 'sumViews']],
        where: { active: true },
        raw: true,
        limit: 1,
      }),
      Post.findAll({
        attributes: [[fn('SUM', col('likes')), 'sumLikes']],
        where: { active: true },
        raw: true,
        limit: 1,
      }),
      Post.findAll({
        attributes: ['section', [fn('COUNT', col('id')), 'count']],
        where: { active: true },
        group: ['section'],
        raw: true,
      }),
    ]);
    const totalViews = parseInt(viewsAgg?.[0]?.sumViews || 0, 10);
    const totalLikes = parseInt(likesAgg?.[0]?.sumLikes || 0, 10);
    const bySection = {};
    for (const r of bySectionRows) {
      bySection[r.section] = parseInt(r.count, 10);
    }

    // ---- Appointments (global) ----
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

    // ---- Respuesta ----
    return res.json({
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
    return res.status(500).json({ message: 'Error al obtener estadísticas del sistema' });
  }
};

const getProfessionalStats = async (req, res) => {
  try {
    const { professionalId } = req.params;
    const now = new Date();

    // Pacientes del profesional
    const [total, activeCount] = await Promise.all([
      Patient.count({ where: { active: true, professionalId } }),
      Patient.count({ where: { active: true, professionalId, status: 'active' } }),
    ]);

    // Pacientes con próximas citas (distinct patientId)
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

    // Citas del profesional (completadas y próximas)
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

    // "Notas": derivadas de citas (texto y audio)
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

    return res.json({
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
    return res.status(500).json({ message: 'Error al obtener estadísticas del profesional' });
  }
};

module.exports = {
  getSystemStats,
  getProfessionalStats
}; 