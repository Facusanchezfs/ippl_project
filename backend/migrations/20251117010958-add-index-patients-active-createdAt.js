'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // OPTIMIZACIÓN CRÍTICA #2: Índice para getAllPatients
    // PROBLEMA: Query sin índice optimizado para ORDER BY (active, createdAt DESC)
    // IMPACTO: Escaneo completo de tabla en lugar de usar índice
    // SOLUCIÓN: Crear índice compuesto (active, createdAt DESC)
    // COMPATIBILIDAD: No afecta queries existentes, solo mejora performance
    
    await queryInterface.addIndex('Patients', ['active', 'createdAt'], {
      name: 'idx_patients_active_createdAt',
      order: [['createdAt', 'DESC']], // Orden descendente para ORDER BY optimizado
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('Patients', 'idx_patients_active_createdAt');
  }
};
