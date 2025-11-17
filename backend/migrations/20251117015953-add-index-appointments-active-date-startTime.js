'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // OPTIMIZACIÓN FASE 3 PARTE 2: Índice para getAllAppointments
    // PROBLEMA: Query sin índice optimizado para ORDER BY (active, date DESC, startTime ASC)
    // IMPACTO: Escaneo completo de tabla en lugar de usar índice
    // SOLUCIÓN: Crear índice compuesto (active, date DESC, startTime ASC)
    // COMPATIBILIDAD: No afecta queries existentes, solo mejora performance
    
    await queryInterface.addIndex('Appointments', ['active', 'date', 'startTime'], {
      name: 'idx_appointments_active_date_startTime',
      order: [['date', 'DESC'], ['startTime', 'ASC']], // Orden para ORDER BY optimizado
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('Appointments', 'idx_appointments_active_date_startTime');
  }
};
