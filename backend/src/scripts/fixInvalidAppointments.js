/**
 * Script para detectar y corregir citas inválidas en `appointments`.
 *
 * PROBLEMA:
 * Existen citas con:
 * - startTime NULL
 * - endTime NULL
 * - endTime <= startTime
 *
 * Esto rompe procesos como el CRON de recurrencias.
 *
 * SOLUCIÓN:
 * - Detectar esas citas
 * - Marcarlas como `cancelled`
 *
 * ATENCIÓN:
 * - NO elimina registros
 * - Solo corrige su estado
 *
 * MODO SEGURO:
 * - DRY-RUN por defecto
 * - Usar --apply para ejecutar cambios
 *
 * USO:
 *   node src/scripts/fixInvalidAppointments.js
 *   node src/scripts/fixInvalidAppointments.js --apply
 */

const { sequelize } = require('../../models');

async function main() {
  const argv = process.argv.slice(2);
  const applyChanges = argv.includes('--apply');

  console.log('======================================================');
  console.log('  LIMPIEZA DE CITAS INVÁLIDAS (`appointments`)');
  console.log('======================================================');
  console.log('Modo:', applyChanges ? 'APPLY (ESCRIBE)' : 'DRY-RUN (SOLO LECTURA)');
  console.log('------------------------------------------------------\n');

  const transaction = await sequelize.transaction();

  try {
    // 1. Buscar citas inválidas
    const [invalidAppointments] = await sequelize.query(`
      SELECT id, startTime, endTime, status
      FROM appointments
      WHERE
        startTime IS NULL
        OR endTime IS NULL
        OR endTime <= startTime
    `, { transaction });

    const total = invalidAppointments.length;

    console.log(`Citas inválidas encontradas: ${total}`);

    if (total === 0) {
      console.log('No hay citas inválidas 🎉');
      await transaction.rollback();
      return;
    }

    // Mostrar algunas (preview)
    console.log('\nEjemplos:');
    invalidAppointments.slice(0, 5).forEach(a => {
      console.log(`- ID ${a.id}: start=${a.startTime}, end=${a.endTime}, status=${a.status}`);
    });

    if (!applyChanges) {
      console.log(`\n[DRY-RUN] Se marcarían como 'cancelled' ${total} citas.`);
      await transaction.rollback();
      return;
    }

    console.log('\nAplicando corrección...');

    // 2. Corregir
    const [result] = await sequelize.query(`
      UPDATE appointments
      SET status = 'cancelled'
      WHERE
        startTime IS NULL
        OR endTime IS NULL
        OR endTime <= startTime
    `, { transaction });

    await transaction.commit();

    console.log('\n================== RESUMEN ==================');
    console.log(`Citas afectadas: ${total}`);
    console.log('Acción: status → cancelled');
    console.log('=============================================');

  } catch (error) {
    console.error('\n[ERROR] Falló la limpieza:', error);
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

main().catch(err => {
  console.error('Error inesperado:', err);
  process.exit(1);
});