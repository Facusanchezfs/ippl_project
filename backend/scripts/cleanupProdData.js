'use strict';

/**
 * Script de mantenimiento para producción
 * Elimina datos basura específicos de la base de datos
 * 
 * Uso: npm run cleanup:prod
 */

require('dotenv').config();
const db = require('../models');

const {
  Appointment,
  FrequencyRequest,
  StatusRequest,
  Activity,
  Abono,
  Derivation,
  sequelize
} = db;

// ID del profesional Juan Perez
const PROFESSIONAL_ID = 36;

// IDs de abonos puntuales a eliminar
const ABONO_IDS_TO_DELETE = [13, 3, 1, 2];

/**
 * Función helper para loguear operaciones
 */
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

/**
 * Función helper para contar registros antes de eliminar
 */
async function countRecords(Model, where, transaction) {
  try {
    return await Model.count({ where, transaction });
  } catch (error) {
    log(`⚠️  Error al contar registros en ${Model.name}: ${error.message}`);
    return 0;
  }
}

/**
 * Función helper para eliminar registros de forma segura
 */
async function safeDestroy(Model, where, description, transaction) {
  try {
    const count = await countRecords(Model, where, transaction);
    if (count === 0) {
      log(`ℹ️  ${description}: No se encontraron registros para eliminar`);
      return { count: 0, success: true };
    }

    log(`🗑️  ${description}: Encontrados ${count} registro(s) para eliminar`);
    const result = await Model.destroy({ where, transaction });
    log(`✅ ${description}: Eliminados ${result} registro(s)`);
    return { count: result, success: true };
  } catch (error) {
    log(`❌ ${description}: Error al eliminar - ${error.message}`);
    return { count: 0, success: false, error };
  }
}

/**
 * Función principal
 */
async function cleanupProductionData() {
  log('🚀 Iniciando limpieza de datos de producción...');
  log('');

  // Iniciar transacción
  const transaction = await sequelize.transaction();

  try {
    const results = {
      appointments: { count: 0, success: true },
      frequencyRequests: { count: 0, success: true },
      statusRequests: { count: 0, success: true },
      activities: { count: 0, success: true },
      derivations: { count: 0, success: true },
      abonosByProfessional: { count: 0, success: true },
      abonosByIds: { count: 0, success: true }
    };

    log('📋 Eliminando interacciones del profesional Juan Perez (ID: 36)...');
    log('');

    // 1. Eliminar Appointments del profesional 36
    results.appointments = await safeDestroy(
      Appointment,
      { professionalId: PROFESSIONAL_ID },
      'Appointments del profesional 36',
      transaction
    );

    // 2. Eliminar FrequencyRequests del profesional 36
    results.frequencyRequests = await safeDestroy(
      FrequencyRequest,
      { professionalId: PROFESSIONAL_ID },
      'FrequencyRequests del profesional 36',
      transaction
    );

    // 3. Eliminar StatusRequests del profesional 36
    results.statusRequests = await safeDestroy(
      StatusRequest,
      { professionalId: PROFESSIONAL_ID },
      'StatusRequests del profesional 36',
      transaction
    );

    // 4. Eliminar Activities del profesional 36
    results.activities = await safeDestroy(
      Activity,
      { professionalId: PROFESSIONAL_ID },
      'Activities del profesional 36',
      transaction
    );

    // 5. Eliminar Derivations del profesional 36
    results.derivations = await safeDestroy(
      Derivation,
      { professionalId: PROFESSIONAL_ID },
      'Derivations del profesional 36',
      transaction
    );

    // 6. Eliminar Abonos del profesional 36
    results.abonosByProfessional = await safeDestroy(
      Abono,
      { professionalId: PROFESSIONAL_ID },
      'Abonos del profesional 36',
      transaction
    );

    log('');
    log('📋 Eliminando abonos puntuales por ID...');
    log('');

    // 7. Eliminar abonos puntuales por ID
    for (const abonoId of ABONO_IDS_TO_DELETE) {
      const result = await safeDestroy(
        Abono,
        { id: abonoId },
        `Abono ID ${abonoId}`,
        transaction
      );
      results.abonosByIds.count += result.count;
      if (!result.success) {
        results.abonosByIds.success = false;
      }
    }

    // Verificar si hubo errores
    const hasErrors = Object.values(results).some(r => !r.success);

    if (hasErrors) {
      log('');
      log('❌ Se encontraron errores durante la limpieza. Haciendo rollback...');
      await transaction.rollback();
      log('🔄 Rollback completado');
      return false;
    }

    // Commit de la transacción
    log('');
    log('💾 Haciendo commit de los cambios...');
    await transaction.commit();
    log('✅ Commit completado exitosamente');

    // Resumen final
    log('');
    log('📊 RESUMEN DE LIMPIEZA:');
    log('─'.repeat(50));
    log(`Appointments eliminados: ${results.appointments.count}`);
    log(`FrequencyRequests eliminados: ${results.frequencyRequests.count}`);
    log(`StatusRequests eliminados: ${results.statusRequests.count}`);
    log(`Activities eliminados: ${results.activities.count}`);
    log(`Derivations eliminados: ${results.derivations.count}`);
    log(`Abonos del profesional 36 eliminados: ${results.abonosByProfessional.count}`);
    log(`Abonos puntuales eliminados: ${results.abonosByIds.count}`);
    log('─'.repeat(50));
    const total = Object.values(results).reduce((sum, r) => sum + r.count, 0);
    log(`TOTAL DE REGISTROS ELIMINADOS: ${total}`);
    log('');

    log('✅ Limpieza completada exitosamente');
    return true;

  } catch (error) {
    log('');
    log(`❌ Error crítico durante la limpieza: ${error.message}`);
    log(`Stack trace: ${error.stack}`);
    log('');
    log('🔄 Haciendo rollback...');
    
    try {
      await transaction.rollback();
      log('✅ Rollback completado');
    } catch (rollbackError) {
      log(`❌ Error al hacer rollback: ${rollbackError.message}`);
    }
    
    return false;
  }
}

/**
 * Ejecutar script
 */
(async () => {
  try {
    // Verificar conexión a la base de datos
    log('🔌 Verificando conexión a la base de datos...');
    await sequelize.authenticate();
    log('✅ Conexión establecida');
    log('');

    // Ejecutar limpieza
    const success = await cleanupProductionData();

    // Cerrar conexión
    await sequelize.close();
    log('🔌 Conexión cerrada');

    // Exit code
    process.exit(success ? 0 : 1);

  } catch (error) {
    log('');
    log(`❌ Error fatal: ${error.message}`);
    log(`Stack trace: ${error.stack}`);
    log('');
    
    try {
      await sequelize.close();
    } catch {
      // Ignorar errores al cerrar
    }
    
    process.exit(1);
  }
})();

