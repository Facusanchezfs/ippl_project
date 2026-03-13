'use strict';

const cron = require('node-cron');
const { generateRecurringAppointments } = require('../services/recurringGenerationService');
const logger = require('../utils/logger');

// Ejecuta la generación de citas recurrentes todos los dias a las 02:00am
  cron.schedule('0 2 * * *', async () => {
  try {
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

