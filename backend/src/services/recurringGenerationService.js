'use strict';

const { Op } = require('sequelize');
const { RecurringAppointment, Appointment, Patient, User, VacationRequest } = require('../../models');
const logger = require('../utils/logger');
const { getArgentinaCivilDateString } = require('../utils/civilDateUtils');

/** Normaliza DATEONLY / string / Date a YYYY-MM-DD */
function toYmd(dateVal) {
  if (dateVal == null) return '';
  if (typeof dateVal === 'string') {
    return dateVal.length >= 10 ? dateVal.slice(0, 10) : dateVal;
  }
  if (dateVal instanceof Date) {
    const y = dateVal.getFullYear();
    const m = String(dateVal.getMonth() + 1).padStart(2, '0');
    const d = String(dateVal.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(dateVal).slice(0, 10);
}

function isSimpleFrequencyRecurrence(recurrence) {
  if (recurrence.groupId) return false;
  const f = recurrence.frequency;
  return f === 'weekly' || f === 'biweekly' || f === 'monthly';
}

/**
 * Calcula la próxima fecha basada en la frecuencia de recurrencia.
 * @param {Date|string} lastDate - Fecha de la última cita (Date o string YYYY-MM-DD)
 * @param {string} frequency - Frecuencia: 'weekly', 'biweekly', 'monthly', 'twice_weekly'
 * @returns {string} Fecha en formato YYYY-MM-DD
 */
function calculateNextDate(lastDate, frequency) {
  const ymd = toYmd(lastDate);
  // Parsear manualmente para evitar problemas de timezone
  const [year, month, day] = ymd.split('-').map(Number);
  const nextDate = new Date(year, month - 1, day);

  switch (frequency) {
    case 'weekly':
    case 'twice_weekly':
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
async function generateRecurringAppointments(options = {}) {
  try {
    const maxAttemptsPerRecurrence = Math.max(
      1,
      Number.parseInt(options.maxAttemptsPerRecurrence ?? 10, 10) || 10
    );
    // Misma convención que el CRON de auto-complete: fecha civil del servidor (local), YYYY-MM-DD.
    // `Appointment.date` es DATEONLY, por lo que comparamos por fecha civil sin zona horaria.
    const today = getArgentinaCivilDateString();

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
          attributes: ['id', 'name', 'active', 'status'],
        });

        if (!patient || patient.active === false || patient.status === 'inactive') {
          logger.info(
            `[RecurringGeneration] Paciente ${recurrence.patientId} inactive/no encontrado para recurrencia ${recurrence.id}, saltando`
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

        // Plantilla horario/monto: la próxima cita futura programada (la que edita el admin).
        // Si copiáramos solo desde `baseAppointment`, un arancel nuevo quedaría mal al quedar
        // la base en el pasado o completada.
        const templateAppointment = await Appointment.findOne({
          where: {
            recurringAppointmentId: recurrence.id,
            active: true,
            status: 'scheduled',
            date: { [Op.gte]: today },
          },
          order: [
            ['date', 'ASC'],
            ['startTime', 'ASC'],
          ],
        });
        const slotSource = templateAppointment || baseAppointment;

        // 3) Contar cuántas citas FUTURAS scheduled existen para esta recurrencia.
        // Contrato esperado: mantener SIEMPRE 2 citas futuras en estado 'scheduled' por recurrencia activa.
        let futureScheduledCount = await Appointment.count({
          where: {
            recurringAppointmentId: recurrence.id,
            active: true,
            status: 'scheduled',
            date: { [Op.gte]: today },
          },
        });

        // Tras varios cambios de frecuencia (admin / solicitudes), pueden quedar 2+ citas futuras
        // que NO respetan la cadencia actual de `recurrence.frequency`. El generador las veía,
        // hacía `continue` y nunca corregía (ej. semanal en UI pero 14/04 → 05/05 = 3 semanas).
        if (futureScheduledCount >= 2 && isSimpleFrequencyRecurrence(recurrence)) {
          const futures = await Appointment.findAll({
            where: {
              recurringAppointmentId: recurrence.id,
              active: true,
              status: 'scheduled',
              date: { [Op.gte]: today },
            },
            order: [
              ['date', 'ASC'],
              ['startTime', 'ASC'],
            ],
            attributes: ['id', 'date'],
          });

          if (futures.length >= 2) {
            let mismatchIdx = -1;
            for (let i = 1; i < futures.length; i++) {
              const prevYmd = toYmd(futures[i - 1].date);
              const curYmd = toYmd(futures[i].date);
              const expected = calculateNextDate(prevYmd, recurrence.frequency);
              if (curYmd !== expected) {
                mismatchIdx = i;
                break;
              }
            }

            if (mismatchIdx !== -1) {
              const cancelIds = futures.slice(mismatchIdx).map((f) => f.id);
              await Appointment.update(
                { status: 'cancelled' },
                {
                  where: { id: { [Op.in]: cancelIds } },
                  validate: false,
                  hooks: false,
                }
              );
              logger.warn(
                `[RecurringGeneration] Cadencia inconsistente con frequency=${recurrence.frequency} (recurrencia ${recurrence.id}): canceladas ${cancelIds.length} cita(s) desde índice ${mismatchIdx} para regenerar con la regla vigente`
              );
              futureScheduledCount = await Appointment.count({
                where: {
                  recurringAppointmentId: recurrence.id,
                  active: true,
                  status: 'scheduled',
                  date: { [Op.gte]: today },
                },
              });
            }
          }
        }

        if (futureScheduledCount >= 2) {
          logger.debug(
            `[RecurringGeneration] Ya hay ${futureScheduledCount} citas futuras scheduled para recurrencia ${recurrence.id}, saltando`
          );
          skippedCount++;
          continue;
        }

        // Preparar referencias:
        // - Si hay 1 cita futura scheduled, generar la siguiente a partir de esa última existente.
        // - Si hay 0, usar la baseAppointment como punto de partida.
        let referenceDate = baseAppointment?.date ?? today;

        if (futureScheduledCount === 1) {
          const lastFutureScheduled = await Appointment.findOne({
            where: {
              recurringAppointmentId: recurrence.id,
              active: true,
              status: 'scheduled',
              date: { [Op.gte]: today },
            },
            order: [['date', 'DESC'], ['startTime', 'DESC']],
          });

          if (lastFutureScheduled?.date) {
            referenceDate = lastFutureScheduled.date;
          }
        }

        const vKey = String(recurrence.professionalId);
        const professionalVacations = vacationsByProfessional.get(vKey) || [];

        // Cargar una vez el profesional (para múltiples creations)
        const professional = await User.findByPk(recurrence.professionalId, {
          attributes: ['id', 'name'],
        });

        let futureCreated = 0;
        let attempts = 0;

        // Generar hasta completar (2 - futureScheduledCount) citas futuras scheduled.
        // attempts evita loops infinitos en caso de que muchas fechas caigan en vacaciones o haya duplicados.
        while (
          futureScheduledCount + futureCreated < 2 &&
          attempts < maxAttemptsPerRecurrence
        ) {
          attempts++;

          let candidateDate = calculateNextDate(referenceDate, recurrence.frequency);

          // Asegurar que sea >= hoy (contrato "future").
          while (candidateDate < today) {
            referenceDate = candidateDate;
            candidateDate = calculateNextDate(referenceDate, recurrence.frequency);
          }

          // Vacaciones: si cae en vacaciones, avanzar y seguir buscando.
          const isOnVacation = professionalVacations.some(
            (v) => v.startDate <= candidateDate && v.endDate >= candidateDate
          );
          if (isOnVacation) {
            referenceDate = candidateDate;
            continue;
          }

          // Duplicados: si ya existe una cita scheduled para esa fecha, avanzar y seguir.
          const existingAppointment = await Appointment.findOne({
            where: {
              recurringAppointmentId: recurrence.id,
              date: candidateDate,
              active: true,
              status: 'scheduled',
            },
          });
          if (existingAppointment) {
            referenceDate = candidateDate;
            continue;
          }

          let newAppointment;
          try {
            newAppointment = await Appointment.create({
              patientId: recurrence.patientId,
              patientName:
                patient?.name || slotSource.patientName || 'Paciente no encontrado',
              professionalId: recurrence.professionalId,
              professionalName:
                professional?.name ||
                slotSource.professionalName ||
                'Profesional no encontrado',
              date: candidateDate,
              startTime: slotSource.startTime,
              endTime: slotSource.endTime,
              type: slotSource.type || 'regular',
              status: 'scheduled',
              notes: null,
              audioNote: null,
              sessionCost: slotSource.sessionCost,
              attended: null,
              paymentAmount: null,
              remainingBalance: slotSource.sessionCost,
              recurringAppointmentId: recurrence.id,
              active: true,
            });
          } catch (error) {
            // Hardening mínimo: si ya existe (por race/duplicado),
            // no rompas el cron y seguí buscando la siguiente cita futura.
            if (error?.name === 'SequelizeUniqueConstraintError') {
              referenceDate = candidateDate;
              continue;
            }
            throw error;
          }

          createdCount++;
          futureCreated++;
          referenceDate = candidateDate;

          logger.info(
            `[RecurringGeneration] Creada cita futura #${futureScheduledCount + futureCreated} para paciente ${recurrence.patientId} con profesional ${recurrence.professionalId} en ${candidateDate} ${slotSource.startTime}, con id: ${newAppointment.id}`
          );
        }

        if (futureScheduledCount + futureCreated < 2) {
          logger.warn(
            `[RecurringGeneration] No se pudo completar 2 citas futuras scheduled para recurrencia ${recurrence.id}. Existentes=${futureScheduledCount}, creadas=${futureCreated}, attempts=${attempts}`
          );
        }
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
