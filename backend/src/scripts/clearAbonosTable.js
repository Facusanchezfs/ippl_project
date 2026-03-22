/**
 * Script de utilidad para vaciar la tabla `abonos` (pagos a profesionales).
 *
 * ATENCIÓN - OPERACIÓN IRREVERSIBLE:
 * - Este script ELIMINA TODOS los registros de la tabla `abonos`.
 * - NO elimina la tabla, solo borra sus filas.
 * - Una vez ejecutado con --apply, los datos NO se pueden recuperar
 *   salvo que exista un backup de la base de datos.
 *
 * MODO SEGURO (RECOMENDADO):
 * - Por defecto corre en modo DRY-RUN (no escribe en la BD).
 * - Para aplicar cambios hay que pasar explícitamente --apply.
 *
 * USO:
 *   node src/scripts/clearAbonosTable.js           # solo muestra lo que haría
 *   node src/scripts/clearAbonosTable.js --apply   # ELIMINA realmente todos los registros
 *
 * RECOMENDACIÓN:
 * - Ejecutar SIEMPRE primero sin --apply y revisar la salida.
 * - Hacer backup de la base antes de correr con --apply en producción.
 */

const { sequelize } = require('../../models');

async function main() {
  const argv = process.argv.slice(2);
  const applyChanges = argv.includes('--apply');

  console.log('======================================================');
  console.log('  VACÍO TOTAL DE TABLA `abonos`');
  console.log('======================================================');
  console.log('  ATENCIÓN: ESTA OPERACIÓN ES IRREVERSIBLE');
  console.log('  - NO elimina la tabla, solo sus filas');
  console.log('  - Asegurarse de tener backup reciente');
  console.log('------------------------------------------------------');
  console.log(`Modo: ${applyChanges ? 'APPLY (ESCRIBE EN BD)' : 'DRY-RUN (SOLO LECTURA)'}`);
  console.log('------------------------------------------------------\n');

  const transaction = await sequelize.transaction();

  try {
    // 1) Contar cuántos registros hay actualmente en `abonos`
    const [rows] = await sequelize.query('SELECT COUNT(*) AS count FROM Abonos', {
      transaction,
    });

    // MySQL suele devolver el count como string
    const totalAbonos = parseInt(rows[0].count, 10) || 0;

    console.log(`Registros actuales en tabla \`abonos\`: ${totalAbonos}`);

    if (totalAbonos === 0) {
      console.log('No hay registros en `abonos` para eliminar.');
      await transaction.rollback();
      return;
    }

    if (!applyChanges) {
      console.log(
        `\n[DRY-RUN] Se ELIMINARÍAN ${totalAbonos} registros de la tabla \`abonos\` (pero NO se tocará la BD en este modo).`
      );
      await transaction.rollback();
      return;
    }

    console.log('\nProcediendo a eliminar TODOS los registros de `abonos`...');

    // 2) Eliminar todos los registros de `abonos`
    const [deleteResult] = await sequelize.query('DELETE FROM Abonos', {
      transaction,
    });

    // deleteResult.affectedRows es típico de MySQL; si no está, usamos el total contado
    const deletedCount =
      (deleteResult && typeof deleteResult.affectedRows === 'number'
        ? deleteResult.affectedRows
        : totalAbonos);

    await transaction.commit();

    console.log('\n================== RESUMEN ==================');
    console.log(`Registros antes de eliminar: ${totalAbonos}`);
    console.log(`Registros eliminados:        ${deletedCount}`);
    console.log('=============================================');
  } catch (error) {
    console.error('\n[ERROR CRÍTICO] Vacío de `abonos` abortado:', error);
    try {
      await transaction.rollback();
    } catch {
      // ignorar error de rollback
    }
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

main().catch((err) => {
  console.error('Fallo inesperado en script de vaciado de `abonos`:', err);
  process.exit(1);
});

