'use strict';

const { Op } = require('sequelize');
const { RecurringAppointment, Appointment, Patient, User, VacationRequest } = require('../../models');
const logger = require('../utils/logger');

/**
 * Calcula la próxima fecha basada en la frecuencia de recurrencia.
 * @param {Date|string} lastDate - Fecha de la última cita (Date o string YYYY-MM-DD)
 * @param {string} frequency - Frecuencia: 'weekly', 'biweekly', 'monthly'
 * @returns {string} Fecha en formato YYYY-MM-DD
 */
function calculateNextDate(lastDate, frequency) {
  // Parsear manualmente para evitar problemas de timezone
  const [year, month, day] = lastDate.split('-').map(Number);
  const nextDate = new Date(year, month - 1, day);

  switch (frequency) {
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7);
      break;

    case 'biweekly':
      nextDate.setDate(nextDate.getDate() + 14);
      break;

    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;

    default:
      throw new Error(`Frecuencia no válida: ${frequency}`);
  }

  const y = nextDate.getFullYear();
  const m = String(nextDate.getMonth() + 1).padStart(2, '0');
  const d = String(nextDate.getDate()).padStart(2, '0');

  return `${y}-${m}-${d}`;
}

/**
 * Genera citas automáticamente desde configuraciones de recurrencia activas.
 * El servicio es seguro para ejecutarse múltiples veces y nunca crea duplicados.
 */
async function generateRecurringAppointments() {
  try {
    const today = new Date().toISOString().split('T')[0];

    const vacations = await VacationRequest.findAll({
      where: {
        status: 'approved',
        endDate: { [Op.gte]: today },
      },
      attributes: ['professionalId', 'startDate', 'endDate'],
    });

    const vacationsByProfessional = new Map();
    for (const v of vacations) {
      const key = String(v.professionalId);
      if (!vacationsByProfessional.has(key)) {
        vacationsByProfessional.set(key, []);
      }
      vacationsByProfessional.get(key).push({
        startDate: v.startDate,
        endDate: v.endDate,
      });
    }

    // 1) Obtener todas las configuraciones de recurrencia activas
    const recurrences = await RecurringAppointment.findAll({
      where: { active: true },
      include: [
        {
          model: Appointment,
          as: 'baseAppointment',
          required: true,
        },
      ],
    });

    logger.info(`[RecurringGeneration] Procesando ${recurrences.length} configuraciones de recurrencia activas`);

    let createdCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // 2) Procesar cada recurrencia de forma aislada
    for (const recurrence of recurrences) {
      try {
        // Verificar que el paciente siga activo
        const patient = await Patient.findByPk(recurrence.patientId, {
          attributes: ['id', 'name', 'active'],
        });

        if (!patient || patient.active === false) {
          logger.info(
            `[RecurringGeneration] Paciente ${recurrence.patientId} inactivo o no encontrado para recurrencia ${recurrence.id}, saltando`
          );
          skippedCount++;
          continue;
        }

        // Obtener la cita base para copiar sus datos
        const baseAppointment = recurrence.baseAppointment;

        if (!baseAppointment || !baseAppointment.active) {
          logger.warn(
            `[RecurringGeneration] Cita base ${recurrence.baseAppointmentId} no encontrada o inactiva para recurrencia ${recurrence.id}`
          );
          errorCount++;
          continue;
        }

        // 3) Verificar si ya existe una cita futura programada para esta recurrencia
        // Solo debe existir UNA cita futura programada por recurrencia (comportamiento de lista enlazada)
        const existingFutureAppointment = await Appointment.findOne({
          where: {
            recurringAppointmentId: recurrence.id,
            active: 1,
            status: 'scheduled',
            date: { [Op.gte]: today },
          },
        });

        if (existingFutureAppointment) {
          logger.debug(
            `[RecurringGeneration] Ya existe una cita futura programada para recurrencia ${recurrence.id} (fecha: ${existingFutureAppointment.date}), saltando`
          );
          skippedCount++;
          continue;
        }

        // 4) Encontrar la cita más reciente que pertenece a esta recurrencia
        const lastAppointment = await Appointment.findOne({
          where: {
            recurringAppointmentId: recurrence.id,
            active: true,
          },
          order: [['date', 'DESC'], ['startTime', 'DESC']],
        });

        // Si no hay citas previas para esta recurrencia, usar la cita base como referencia
        const referenceDate = lastAppointment
          ? lastAppointment.date
          : baseAppointment.date;

        // 5) Calcular la próxima fecha según la frecuencia
        const nextDate = calculateNextDate(referenceDate, recurrence.frequency);
        if (nextDate < today) {
          logger.debug(
            `[RecurringGeneration] Fecha calculada ${nextDate} está en el pasado para recurrencia ${recurrence.id}, saltando`
          );
          skippedCount++;
          continue;
        }

        // 6) Verificar si la fecha cae dentro de vacaciones aprobadas
        const vKey = String(recurrence.professionalId);
        const professionalVacations = vacationsByProfessional.get(vKey) || [];
        const isOnVacation = professionalVacations.some(
          (v) => v.startDate <= nextDate && v.endDate >= nextDate
        );

        if (isOnVacation) {
          logger.debug(
            `[RecurringGeneration] Fecha ${nextDate} está dentro de un rango de vacaciones para profesional ${recurrence.professionalId}, saltando`
          );
          skippedCount++;
          continue;
        }

        // 7) Verificar que no exista ya una cita de esta recurrencia en esa fecha
        const existingAppointment = await Appointment.findOne({
          where: {
            recurringAppointmentId: recurrence.id,
            date: nextDate,
            active: true,
          },
        });

        if (existingAppointment) {
          logger.debug(
            `[RecurringGeneration] Cita ya existe para recurrencia ${recurrence.id} en ${nextDate}, saltando`
          );
          skippedCount++;
          continue;
        }

        // 7) Obtener nombres actualizados del paciente y profesional
        const [, professional] = await Promise.all([
          // patient ya fue cargado arriba
          User.findByPk(recurrence.professionalId, {
            attributes: ['id', 'name'],
          }),
        ]);

        // 8) Crear la nueva cita
        const newAppointment = await Appointment.create({
          patientId: recurrence.patientId,
          patientName: patient?.name || baseAppointment.patientName || 'Paciente no encontrado',
          professionalId: recurrence.professionalId,
          professionalName: professional?.name || baseAppointment.professionalName || 'Profesional no encontrado',
          date: nextDate,
          startTime: baseAppointment.startTime,
          endTime: baseAppointment.endTime,
          type: baseAppointment.type || 'regular',
          status: 'scheduled',
          notes: null,
          audioNote: null,
          sessionCost: baseAppointment.sessionCost,
          attended: null,
          paymentAmount: null,
          remainingBalance: baseAppointment.sessionCost,
          recurringAppointmentId: recurrence.id,
          active: true,
        });

        createdCount++;
        logger.info(
          `[RecurringGeneration] Creada cita para paciente ${recurrence.patientId} con profesional ${recurrence.professionalId} en ${nextDate} ${baseAppointment.startTime}, con id: ${newAppointment.id}`
        );
      } catch (error) {
        // Aislar errores: un fallo no detiene el procesamiento de otras recurrencias
        errorCount++;
        logger.error(
          `[RecurringGeneration] Error procesando recurrencia ${recurrence.id}:`,
          error
        );
      }
    }

    logger.info(
      `[RecurringGeneration] Proceso completado. Creadas: ${createdCount}, Saltadas: ${skippedCount}, Errores: ${errorCount}`
    );

    return {
      total: recurrences.length,
      created: createdCount,
      skipped: skippedCount,
      errors: errorCount,
    };
  } catch (error) {
    logger.error('[RecurringGeneration] Error crítico en el servicio:', error);
    throw error;
  }
}

module.exports = {
  generateRecurringAppointments,
};
