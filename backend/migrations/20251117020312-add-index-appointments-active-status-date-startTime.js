'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // OPTIMIZACIÓN FASE 3 PARTE 2: Índice para getSystemStats (citas próximas)
    // PROBLEMA: Query sin índice optimizado para WHERE (active, status, date, startTime) con TIMESTAMP
    // IMPACTO: Escaneo completo de tabla al buscar citas próximas (scheduled y en el futuro)
    // SOLUCIÓN: Crear índice compuesto (active, status, date, startTime)
    // COMPATIBILIDAD: No afecta queries existentes, solo mejora performance
    
    await queryInterface.addIndex('Appointments', ['active', 'status', 'date', 'startTime'], {
      name: 'idx_appointments_active_status_date_startTime',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('Appointments', 'idx_appointments_active_status_date_startTime');
  }
};
