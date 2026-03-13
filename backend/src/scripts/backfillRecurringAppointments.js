 
/**
 * Script de backfill para crear configuraciones de recurrencia
 * en la tabla RecurringAppointments a partir de citas históricas.
 *
 * CARACTERÍSTICAS DE SEGURIDAD:
 * - Por defecto corre en modo DRY-RUN (no escribe en la BD).
 * - Para aplicar cambios hay que pasar explícitamente --apply.
 * - No borra NI modifica citas existentes, solo inserta nuevas filas
 *   en RecurringAppointments y nunca toca registros ya presentes allí.
 *
 * USO:
 *   node src/scripts/backfillRecurringAppointments.js           # solo muestra lo que haría
 *   node src/scripts/backfillRecurringAppointments.js --apply   # crea realmente las recurrencias
 *
 * OPCIONES:
 *   --frequency=weekly|biweekly|monthly  Frecuencia por defecto (weekly si no se indica).
 *   --limit=N                            Máximo de pacientes a procesar (útil para probar).
 *
 * RECOMENDACIÓN:
 * - Ejecutar SIEMPRE primero sin --apply y revisar la salida.
 * - Hacer backup de la base antes de correr con --apply en producción.
 */

const { Appointment, RecurringAppointment, Patient, sequelize } = require('../../models');
const { Op } = require('sequelize');

async function main() {
  const argv = process.argv.slice(2);
  const applyChanges = argv.includes('--apply');

  const freqArg = argv.find((a) => a.startsWith('--frequency='));
  const limitArg = argv.find((a) => a.startsWith('--limit='));

  const defaultFrequency = freqArg
    ? freqArg.split('=')[1]
    : 'weekly';

  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;

  if (!['weekly', 'biweekly', 'monthly'].includes(defaultFrequency)) {
    console.error(
      `Frecuencia inválida "${defaultFrequency}". Debe ser weekly, biweekly o monthly.`
    );
    process.exit(1);
  }

  console.log('======================================================');
  console.log(' Backfill de RecurringAppointments (modo seguro)');
  console.log('======================================================');
  console.log(`Modo: ${applyChanges ? 'APPLY (ESCRIBE EN BD)' : 'DRY-RUN (SOLO LECTURA)'}`);
  console.log(`Frecuencia por defecto: ${defaultFrequency}`);
  if (limit != null && !Number.isNaN(limit)) {
    console.log(`Límite de pacientes: ${limit}`);
  }
  console.log('------------------------------------------------------\n');

  const transaction = await sequelize.transaction();

  try {
    // 1) Buscar pacientes activos con profesional asignado
    const patientWhere = { active: true, professionalId: { [Op.ne]: null } };

    const patients = await Patient.findAll({
      where: patientWhere,
      order: [['id', 'ASC']],
      transaction,
      lock: transaction.LOCK.UPDATE,
      ...(limit && { limit }),
    });

    if (!patients.length) {
      console.log('No se encontraron pacientes que cumplan los criterios.');
      await transaction.rollback();
      return;
    }

    console.log(`Pacientes candidatos encontrados: ${patients.length}`);

    let totalCreated = 0;
    let totalSkippedHasRecurrence = 0;
    let totalSkippedNoAppointments = 0;

    for (const patient of patients) {
      const pid = patient.id;
      const profId = patient.professionalId;

      console.log('\n------------------------------------------------------');
      console.log(`Paciente ID=${pid} | Nombre="${patient.name}" | Prof=${profId}`);

      // 2) Verificar si YA tiene alguna recurrencia activa
      const existingRecurrence = await RecurringAppointment.findOne({
        where: { patientId: pid, active: true },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (existingRecurrence) {
        console.log(
          `  -> SKIP: ya tiene RecurringAppointment id=${existingRecurrence.id} (no se toca).`
        );
        totalSkippedHasRecurrence++;
        continue;
      }

      // 3) Buscar citas históricas del paciente con ese profesional
      const appointments = await Appointment.findAll({
        where: {
          patientId: pid,
          professionalId: profId,
          active: true,
        },
        order: [
          ['date', 'ASC'],
          ['startTime', 'ASC'],
        ],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!appointments.length) {
        console.log('  -> SKIP: no tiene citas activas con este profesional.');
        totalSkippedNoAppointments++;
        continue;
      }

      // Elegir como cita base la ÚLTIMA cita cronológica
      const baseAppointment = appointments[appointments.length - 1];

      console.log(
        `  -> Cita base candidata: Appointment id=${baseAppointment.id}, ` +
          `fecha=${baseAppointment.date}, hora=${baseAppointment.startTime}`
      );

      if (!applyChanges) {
        console.log(
          `  [DRY-RUN] Se CREARÍA RecurringAppointment { patientId: ${pid}, professionalId: ${profId}, baseAppointmentId: ${baseAppointment.id}, frequency: "${defaultFrequency}" }`
        );
        totalCreated++;
        continue;
      }

      const created = await RecurringAppointment.create(
        {
          patientId: pid,
          professionalId: profId,
          baseAppointmentId: baseAppointment.id,
          frequency: defaultFrequency,
          active: true,
        },
        { transaction }
      );

      console.log(
        `  -> CREATED RecurringAppointment id=${created.id} (freq=${created.frequency})`
      );
      totalCreated++;
    }

    if (applyChanges) {
      await transaction.commit();
    } else {
      await transaction.rollback();
    }

    console.log('\n================== RESUMEN ==================');
    console.log(`Total pacientes procesados: ${patients.length}`);
    console.log(`RecurringAppointments ${applyChanges ? 'creadas' : 'que se crearían'}: ${totalCreated}`);
    console.log(`Saltados (ya tenían recurrencia): ${totalSkippedHasRecurrence}`);
    console.log(`Saltados (sin citas activas): ${totalSkippedNoAppointments}`);
    console.log('=============================================');
  } catch (error) {
    console.error('\n[ERROR CRÍTICO] Backfill abortado:', error);
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
  console.error('Fallo inesperado en script de backfill:', err);
  process.exit(1);
});

