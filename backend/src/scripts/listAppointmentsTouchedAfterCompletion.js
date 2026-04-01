'use strict';

/**
 * Diagnóstico: citas completadas cuyo `updatedAt` es posterior a `completedAt`.
 * Suele indicar que algo escribió la fila después de cerrar la sesión (p. ej. un
 * update masivo de recurrencia que pisó `sessionCost` en la cita base histórica).
 *
 * No corrige datos: solo lista candidatas a revisión manual o backup.
 *
 * USO:
 *   node src/scripts/listAppointmentsTouchedAfterCompletion.js
 */

const { sequelize } = require('../../models');
const { QueryTypes } = require('sequelize');

async function main() {
  const rows = await sequelize.query(
    `
    SELECT
      id,
      patientId,
      patientName,
      professionalId,
      date,
      sessionCost,
      paymentAmount,
      remainingBalance,
      completedAt,
      updatedAt
    FROM Appointments
    WHERE active = 1
      AND status = 'completed'
      AND completedAt IS NOT NULL
      AND updatedAt > completedAt
    ORDER BY updatedAt DESC
    LIMIT 500
    `,
    { type: QueryTypes.SELECT }
  );

  console.log(
    `Citas completed con updatedAt > completedAt: ${rows.length} (máx. 500 mostradas)\n`
  );
  for (const r of rows) {
    console.log(
      JSON.stringify(
        {
          id: String(r.id),
          patientId: r.patientId != null ? String(r.patientId) : null,
          patientName: r.patientName,
          professionalId: r.professionalId != null ? String(r.professionalId) : null,
          date: r.date,
          sessionCost: r.sessionCost,
          paymentAmount: r.paymentAmount,
          remainingBalance: r.remainingBalance,
          completedAt: r.completedAt,
          updatedAt: r.updatedAt,
        },
        null,
        0
      )
    );
  }

  if (!rows.length) {
    console.log(
      'Ninguna fila en ese criterio. (No garantiza que no haya habido pisadas sin mover updatedAt.)'
    );
  }

  await sequelize.close();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await sequelize.close();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
