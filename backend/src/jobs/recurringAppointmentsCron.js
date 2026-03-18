'use strict';

const cron = require('node-cron');
const { generateRecurringAppointments } = require('../services/recurringGenerationService');
const logger = require('../utils/logger');
const { Appointment } = require('../../models');
const { Op } = require('sequelize');

// Ejecuta la generación de citas recurrentes todos los dias (cron configurado externamente)
cron.schedule('* * * * *', async () => {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);

    try {
      const [affectedRows] = await Appointment.update(
        { status: 'completed' },
        {
          where: {
            date: { [Op.lt]: todayStr },
            status: { [Op.notIn]: ['completed', 'cancelled'] },
            active: true,
          },
          individualHooks: true,
        }
      );

      logger.info(
        `[RecurringCron] Auto-completed ${affectedRows} past appointments (date < ${todayStr})`
      );
    } catch (autoErr) {
      logger.error(
        '[RecurringCron] Error auto-completing past appointments:',
        autoErr
      );
      // No relanzamos el error para no impedir la generación de recurrencias
    }

    logger.info('[RecurringCron] Starting recurring appointment generation');

    const result = await generateRecurringAppointments();

    logger.info(
      `[RecurringCron] Finished generation: ${JSON.stringify(result)}`
    );
  } catch (error) {
    logger.error(
      '[RecurringCron] Failed to generate recurring appointments',
      error
    );
  }
});
