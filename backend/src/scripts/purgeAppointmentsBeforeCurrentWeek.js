/**
 * Elimina citas con fecha estrictamente anterior al lunes de la semana calendario
 * actual (Argentina, misma referencia que agenda y CRON), y lo vinculado:
 * - Solicitudes de cancelación (FK CASCADE al borrar la cita).
 * - Recurrencias cuya cita base está en ese rango (antes de borrar citas).
 * - Actividades de tipo cancelación de cita cuyo metadata.appointmentId apunta a esas citas.
 * - Revierte saldos del profesional como en deleteAppointment para citas
 *   completed + attended + sessionCost (solo las que se borran).
 *
 * NO borra citas de semanas futuras ni de la semana actual (lunes–domingo AR).
 *
 * MODO:
 * - DRY-RUN por defecto: solo cuenta y muestra el alcance.
 * - `--apply` ejecuta en una transacción.
 *
 * USO:
 *   node src/scripts/purgeAppointmentsBeforeCurrentWeek.js
 *   node src/scripts/purgeAppointmentsBeforeCurrentWeek.js --apply
 */

'use strict';

const { Op } = require('sequelize');
const { sequelize, Appointment, User } = require('../../models');
const {
  getArgentinaCivilDateString,
  AR_TIMEZONE,
} = require('../utils/civilDateUtils');

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * Lunes (YYYY-MM-DD) de la semana que contiene `now`, según calendario en Argentina.
 */
function mondayYmdArgentinaWeekContaining(now = new Date()) {
  const ymd = getArgentinaCivilDateString(now);
  const d = new Date(`${ymd}T12:00:00-03:00`);
  const short = new Intl.DateTimeFormat('en-US', {
    timeZone: AR_TIMEZONE,
    weekday: 'short',
  }).format(d);
  const delta = { Sun: -6, Mon: 0, Tue: -1, Wed: -2, Thu: -3, Fri: -4, Sat: -5 }[
    short
  ];
  if (delta === undefined) {
    throw new Error(`weekday short no reconocido: ${short}`);
  }
  const mondayMs = d.getTime() + delta * 86400000;
  return getArgentinaCivilDateString(new Date(mondayMs));
}

const APPOINTMENT_ACTIVITY_TYPES = [
  'APPOINTMENT_CANCELLATION_REQUESTED',
  'APPOINTMENT_CANCELLATION_APPROVED',
  'APPOINTMENT_CANCELLATION_REJECTED',
];

async function main() {
  const argv = process.argv.slice(2);
  const applyChanges = argv.includes('--apply');

  const weekStart = mondayYmdArgentinaWeekContaining();
  const todayStr = getArgentinaCivilDateString();

  console.log('==============================================================');
  console.log('  PURGA: citas anteriores a la semana actual (Argentina)');
  console.log('==============================================================');
  console.log('Hoy (AR):', todayStr);
  console.log('Inicio de semana (lunes AR, inclusive):', weekStart);
  console.log('Se borrarán citas con date <', weekStart);
  console.log('Modo:', applyChanges ? 'APPLY (ESCRIBE)' : 'DRY-RUN (solo lectura)');
  console.log('--------------------------------------------------------------');

  const oldWhere = { date: { [Op.lt]: weekStart } };

  const apptCount = await Appointment.count({ where: oldWhere });
  const [recurringRows] = await sequelize.query(
    `
    SELECT COUNT(*) AS cnt
    FROM RecurringAppointments ra
    INNER JOIN Appointments a ON a.id = ra.baseAppointmentId
    WHERE a.date < :weekStart
    `,
    { replacements: { weekStart } }
  );
  const recurringToDrop = Number(recurringRows?.[0]?.cnt ?? 0);

  const [activityRows] = await sequelize.query(
    `
    SELECT COUNT(*) AS cnt
    FROM Activities
    WHERE type IN (:types)
      AND JSON_EXTRACT(metadata, '$.appointmentId') IS NOT NULL
      AND CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.appointmentId')) AS UNSIGNED) IN (
        SELECT id FROM Appointments WHERE date < :weekStart
      )
    `,
    {
      replacements: { types: APPOINTMENT_ACTIVITY_TYPES, weekStart },
    }
  );
  const activityCount = Number(activityRows?.[0]?.cnt ?? 0);

  const [acrRows] = await sequelize.query(
    `
    SELECT COUNT(*) AS cnt
    FROM AppointmentCancellationRequests acr
    INNER JOIN Appointments a ON a.id = acr.appointmentId
    WHERE a.date < :weekStart
    `,
    { replacements: { weekStart } }
  );
  const acrTotal = Number(acrRows?.[0]?.cnt ?? 0);

  const forBalance = await Appointment.findAll({
    where: {
      ...oldWhere,
      status: 'completed',
      attended: true,
      professionalId: { [Op.ne]: null },
      sessionCost: { [Op.gt]: 0 },
    },
    attributes: [
      'professionalId',
      [sequelize.fn('SUM', sequelize.col('sessionCost')), 'sessionSum'],
    ],
    group: ['professionalId'],
    raw: true,
  });

  console.log('Citas a eliminar (hard delete):', apptCount);
  console.log('RecurringAppointments (base en rango a borrar):', recurringToDrop);
  console.log('Actividades (cancelación de cita ligadas a esas citas):', activityCount);
  console.log('Solicitudes cancelación ligadas (se borran con la cita, CASCADE):', acrTotal);
  console.log('Profesionales con reversión de saldo (grupos):', forBalance.length);
  forBalance.forEach((r) => {
    console.log(
      `  - professionalId=${r.professionalId} suma sessionCost=${r.sessionSum}`
    );
  });

  if (!applyChanges) {
    console.log('--------------------------------------------------------------');
    console.log('No se escribió nada. Pasá --apply para ejecutar la purga.');
    console.log('Recomendación: backup de la BD antes de --apply.');
    await sequelize.close();
    return;
  }

  if (apptCount === 0 && recurringToDrop === 0 && activityCount === 0) {
    console.log('Nada que borrar.');
    await sequelize.close();
    return;
  }

  const t = await sequelize.transaction();
  try {
    for (const row of forBalance) {
      const pid = row.professionalId;
      const sessionSum = round2(Number(row.sessionSum) || 0);
      if (!pid || sessionSum <= 0) continue;

      const prof = await User.findByPk(pid, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!prof) continue;

      const currentTotal = round2(Number(prof.saldoTotal) || 0);
      const newTotal = round2(Math.max(0, currentTotal - sessionSum));

      let commissionInt = parseInt(prof.commission ?? 0, 10);
      if (Number.isNaN(commissionInt)) commissionInt = 0;
      commissionInt = Math.max(0, Math.min(100, commissionInt));
      const commissionRate = commissionInt / 100;
      const newPend = round2(newTotal * commissionRate);

      await prof.update(
        { saldoTotal: newTotal, saldoPendiente: newPend },
        { transaction: t }
      );
    }

    await sequelize.query(
      `
      DELETE FROM Activities
      WHERE type IN (:types)
        AND JSON_EXTRACT(metadata, '$.appointmentId') IS NOT NULL
        AND CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.appointmentId')) AS UNSIGNED) IN (
          SELECT id FROM Appointments WHERE date < :weekStart
        )
      `,
      { replacements: { types: APPOINTMENT_ACTIVITY_TYPES, weekStart }, transaction: t }
    );

    await sequelize.query(
      `
      DELETE ra FROM RecurringAppointments ra
      INNER JOIN Appointments a ON a.id = ra.baseAppointmentId
      WHERE a.date < :weekStart
      `,
      { replacements: { weekStart }, transaction: t }
    );

    await Appointment.destroy({
      where: oldWhere,
      transaction: t,
    });

    await t.commit();
    console.log('--------------------------------------------------------------');
    console.log('Purga aplicada correctamente.');
  } catch (e) {
    await t.rollback();
    console.error('Error en purga (rollback):', e);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

main();
