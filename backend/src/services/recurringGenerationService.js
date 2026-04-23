'use strict';

const { Op } = require('sequelize');
const {
  RecurringAppointment,
  Appointment,
  Patient,
  User,
  VacationRequest,
  sequelize,
} = require('../../models');
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

        const vKey = String(recurrence.professionalId);
        const professionalVacations = vacationsByProfessional.get(vKey) || [];

        const professional = await User.findByPk(recurrence.professionalId, {
          attributes: ['id', 'name'],
        });

        const txOutcome = await sequelize.transaction(async (t) => {
          const lockedRec = await RecurringAppointment.findByPk(recurrence.id, {
            transaction: t,
            lock: t.LOCK.UPDATE,
            include: [
              {
                model: Appointment,
                as: 'baseAppointment',
                required: true,
              },
            ],
          });

          if (!lockedRec || !lockedRec.active) {
            return { kind: 'skip_inactive_recurrence' };
          }

          const base = lockedRec.baseAppointment;
          if (!base || !base.active) {
            return { kind: 'error_no_base' };
          }

          const recurrenceId = lockedRec.id;
          const frequency = lockedRec.frequency;

          const templateAppointment = await Appointment.findOne({
            where: {
              recurringAppointmentId: recurrenceId,
              active: true,
              status: 'scheduled',
              date: { [Op.gte]: today },
            },
            order: [
              ['date', 'ASC'],
              ['startTime', 'ASC'],
            ],
            transaction: t,
          });
          const slotSource = templateAppointment || base;

          let futureScheduledCount = await Appointment.count({
            where: {
              recurringAppointmentId: recurrenceId,
              active: true,
              status: 'scheduled',
              date: { [Op.gte]: today },
            },
            transaction: t,
          });

          if (futureScheduledCount >= 2 && isSimpleFrequencyRecurrence(lockedRec)) {
            const futures = await Appointment.findAll({
              where: {
                recurringAppointmentId: recurrenceId,
                active: true,
                status: 'scheduled',
                date: { [Op.gte]: today },
              },
              order: [
                ['date', 'ASC'],
                ['startTime', 'ASC'],
              ],
              attributes: ['id', 'date'],
              transaction: t,
            });

            if (futures.length >= 2) {
              let mismatchIdx = -1;
              for (let i = 1; i < futures.length; i++) {
                const prevYmd = toYmd(futures[i - 1].date);
                const curYmd = toYmd(futures[i].date);
                const expected = calculateNextDate(prevYmd, frequency);
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
                    transaction: t,
                  }
                );
                logger.warn(
                  `[RecurringGeneration] Cadencia inconsistente con frequency=${frequency} (recurrencia ${recurrenceId}): canceladas ${cancelIds.length} cita(s) desde índice ${mismatchIdx} para regenerar con la regla vigente`
                );
                futureScheduledCount = await Appointment.count({
                  where: {
                    recurringAppointmentId: recurrenceId,
                    active: true,
                    status: 'scheduled',
                    date: { [Op.gte]: today },
                  },
                  transaction: t,
                });
              }
            }
          }

          if (futureScheduledCount >= 2) {
            logger.debug(
              `[RecurringGeneration] Ya hay ${futureScheduledCount} citas futuras scheduled para recurrencia ${recurrenceId}, saltando`
            );
            return { kind: 'skipped_buffered' };
          }

          let referenceDate = base?.date ?? today;

          if (futureScheduledCount === 1) {
            const lastFutureScheduled = await Appointment.findOne({
              where: {
                recurringAppointmentId: recurrenceId,
                active: true,
                status: 'scheduled',
                date: { [Op.gte]: today },
              },
              order: [['date', 'DESC'], ['startTime', 'DESC']],
              transaction: t,
            });

            if (lastFutureScheduled?.date) {
              referenceDate = lastFutureScheduled.date;
            }
          }

          let futureCreated = 0;
          let attempts = 0;

          while (
            futureScheduledCount + futureCreated < 2 &&
            attempts < maxAttemptsPerRecurrence
          ) {
            attempts++;

            let candidateDate = calculateNextDate(referenceDate, frequency);

            while (candidateDate < today) {
              referenceDate = candidateDate;
              candidateDate = calculateNextDate(referenceDate, frequency);
            }

            const isOnVacation = professionalVacations.some(
              (vac) => vac.startDate <= candidateDate && vac.endDate >= candidateDate
            );
            if (isOnVacation) {
              referenceDate = candidateDate;
              continue;
            }

            const cancelledSameSlot = await Appointment.findOne({
              where: {
                recurringAppointmentId: recurrenceId,
                date: candidateDate,
                active: true,
                status: 'cancelled',
                startTime: slotSource.startTime,
              },
              transaction: t,
            });
            if (cancelledSameSlot) {
              referenceDate = candidateDate;
              continue;
            }

            const existingAppointment = await Appointment.findOne({
              where: {
                recurringAppointmentId: recurrenceId,
                date: candidateDate,
                active: true,
                status: 'scheduled',
              },
              transaction: t,
            });
            if (existingAppointment) {
              referenceDate = candidateDate;
              continue;
            }

            let newAppointment;
            try {
              newAppointment = await Appointment.create(
                {
                  patientId: lockedRec.patientId,
                  patientName:
                    patient?.name || slotSource.patientName || 'Paciente no encontrado',
                  professionalId: lockedRec.professionalId,
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
                  recurringAppointmentId: recurrenceId,
                  active: true,
                },
                { transaction: t }
              );
            } catch (error) {
              if (error?.name === 'SequelizeUniqueConstraintError') {
                logger.warn(
                  `[RecurringGeneration] UniqueConstraint al generar cita recurrente recurringAppointmentId=${recurrenceId} candidateDate=${candidateDate} startTime=${slotSource.startTime}: ${error?.message || 'duplicado'}`
                );
                futureScheduledCount = await Appointment.count({
                  where: {
                    recurringAppointmentId: recurrenceId,
                    active: true,
                    status: 'scheduled',
                    date: { [Op.gte]: today },
                  },
                  transaction: t,
                });
                referenceDate = candidateDate;
                continue;
              }
              throw error;
            }

            futureCreated++;
            referenceDate = candidateDate;

            logger.info(
              `[RecurringGeneration] Creada cita futura #${futureScheduledCount + futureCreated} para paciente ${lockedRec.patientId} con profesional ${lockedRec.professionalId} en ${candidateDate} ${slotSource.startTime}, con id: ${newAppointment.id}`
            );
          }

          if (futureScheduledCount + futureCreated < 2) {
            logger.warn(
              `[RecurringGeneration] No se pudo completar 2 citas futuras scheduled para recurrencia ${recurrenceId}. Existentes=${futureScheduledCount}, creadas=${futureCreated}, attempts=${attempts}`
            );
          }

          return { kind: 'ok', created: futureCreated };
        });

        if (txOutcome.kind === 'skip_inactive_recurrence') {
          skippedCount++;
          continue;
        }
        if (txOutcome.kind === 'error_no_base') {
          logger.warn(
            `[RecurringGeneration] Cita base inválida tras lock para recurrencia ${recurrence.id}`
          );
          errorCount++;
          continue;
        }
        if (txOutcome.kind === 'skipped_buffered') {
          skippedCount++;
          continue;
        }

        createdCount += txOutcome.created;
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
  calculateNextDate,
  toYmd,
};
