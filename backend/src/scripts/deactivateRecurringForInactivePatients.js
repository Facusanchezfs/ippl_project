/**
 * Desactiva recurrencias (`RecurringAppointments.active = false`) y cancela
 * citas futuras `Appointments.status = 'scheduled'` para pacientes inactivos.
 *
 * OBJETIVO:
 * - Evitar que el CRON vuelva a generar/mostrar agenda para pacientes deshabilitados.
 * - Corregir inconsistencias históricas dejando el sistema consistente.
 *
 * MODO:
 * - DRY-RUN por defecto: SOLO muestra qué se haría (no escribe).
 * - Usar `--apply` para ejecutar los UPDATE.
 *
 * USO:
 *   node src/scripts/deactivateRecurringForInactivePatients.js
 *   node src/scripts/deactivateRecurringForInactivePatients.js --apply
 */

const { sequelize } = require('../../models');
const { getArgentinaCivilDateString } = require('../utils/civilDateUtils');

async function main() {
  const argv = process.argv.slice(2);
  const applyChanges = argv.includes('--apply');

  console.log('======================================================');
  console.log('  DESACTIVAR RECURRENCIAS PARA PACIENTES INACTIVOS');
  console.log('======================================================');
  console.log('Modo:', applyChanges ? 'APPLY (ESCRIBE)' : 'DRY-RUN (SOLO LECTURA)');
  console.log('------------------------------------------------------');

  const todayStr = getArgentinaCivilDateString();

  const transaction = await sequelize.transaction();
  try {
    // 1) Cantidad de recurrencias que se desactivarían
    const [recurringCountRows] = await sequelize.query(
      `
      SELECT COUNT(*) AS countToDisable
      FROM RecurringAppointments ra
      JOIN Patients p ON p.id = ra.patientId
      WHERE
        ra.active = 1
        AND (p.status = 'inactive' OR p.active = 0)
      `,
      { transaction }
    );

    const countToDisable = Number(recurringCountRows?.[0]?.countToDisable ?? 0);

    // 2) Cantidad de citas futuras programadas que se cancelarían
    const [appointmentsCountRows] = await sequelize.query(
      `
      SELECT COUNT(*) AS countToCancel
      FROM Appointments a
      JOIN Patients p ON p.id = a.patientId
      WHERE
        a.status = 'scheduled'
        AND a.active = 1
        AND a.date >= :today
        AND (p.status = 'inactive' OR p.active = 0)
      `,
      { transaction, replacements: { today: todayStr } }
    );

    const countToCancel = Number(appointmentsCountRows?.[0]?.countToCancel ?? 0);

    console.log(`Fecha civil hoy (Argentina): ${todayStr}`);
    console.log(`Recurrencias a desactivar: ${countToDisable}`);
    console.log(`Citas futuras a cancelar: ${countToCancel}`);

    if (countToDisable > 0 || countToCancel > 0) {
      const [sampleRecurringRows] = await sequelize.query(
        `
        SELECT
          ra.id AS recurringAppointmentId,
          ra.patientId,
          ra.professionalId,
          ra.frequency,
          ra.active,
          p.status AS patientStatus,
          p.active AS patientActive
        FROM RecurringAppointments ra
        JOIN Patients p ON p.id = ra.patientId
        WHERE
          ra.active = 1
          AND (p.status = 'inactive' OR p.active = 0)
        ORDER BY ra.id DESC
        LIMIT 10
        `,
        { transaction }
      );

      console.log('\nEjemplos de recurrencias (max 10):');
      sampleRecurringRows.forEach((r) => {
        console.log(
          `- recurringId=${r.recurringAppointmentId} patientId=${r.patientId} freq=${r.frequency} patientStatus=${r.patientStatus} patientActive=${r.patientActive}`
        );
      });

      const [sampleAppointmentsRows] = await sequelize.query(
        `
        SELECT
          a.id AS appointmentId,
          a.patientId,
          a.date,
          a.startTime,
          a.status,
          p.status AS patientStatus
        FROM Appointments a
        JOIN Patients p ON p.id = a.patientId
        WHERE
          a.status = 'scheduled'
          AND a.active = 1
          AND a.date >= :today
          AND (p.status = 'inactive' OR p.active = 0)
        ORDER BY a.date ASC, a.startTime ASC
        LIMIT 10
        `,
        { transaction, replacements: { today: todayStr } }
      );

      console.log('\nEjemplos de citas futuras (max 10):');
      sampleAppointmentsRows.forEach((a) => {
        console.log(
          `- appointmentId=${a.appointmentId} patientId=${a.patientId} date=${a.date} start=${a.startTime} patientStatus=${a.patientStatus}`
        );
      });
    }

    if (!applyChanges) {
      console.log('\n[DRY-RUN] No se ejecutó ningún UPDATE. Se hace rollback.');
      await transaction.rollback();
      return;
    }

    console.log('\nAplicando cambios...');

    // 3) Desactivar recurrencias activas de pacientes inactivos
    await sequelize.query(
      `
      UPDATE RecurringAppointments ra
      JOIN Patients p ON p.id = ra.patientId
      SET ra.active = 0
      WHERE
        ra.active = 1
        AND (p.status = 'inactive' OR p.active = 0)
      `,
      { transaction }
    );

    // 4) Cancelar citas futuras scheduled de pacientes inactivos
    await sequelize.query(
      `
      UPDATE Appointments a
      JOIN Patients p ON p.id = a.patientId
      SET a.status = 'cancelled'
      WHERE
        a.status = 'scheduled'
        AND a.active = 1
        AND a.date >= :today
        AND (p.status = 'inactive' OR p.active = 0)
      `,
      { transaction, replacements: { today: todayStr } }
    );

    await transaction.commit();
    console.log('\nOK: recurrencias desactivadas y citas futuras canceladas.');
  } catch (error) {
    console.error('\n[ERROR] Falló el script:', error);
    try {
      await transaction.rollback();
    } catch {
      // ignore rollback error
    }
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

main().catch((err) => {
  console.error('Error inesperado:', err);
  process.exit(1);
});

