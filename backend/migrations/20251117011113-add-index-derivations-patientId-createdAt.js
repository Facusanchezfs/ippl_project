'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // OPTIMIZACIÓN CRÍTICA #2: Índice para getAllPatients (optimización de derivaciones)
    // PROBLEMA: Query de derivaciones sin índice optimizado para WHERE + ORDER BY
    // IMPACTO: Escaneo completo de tabla Derivations al buscar última derivación por paciente
    // SOLUCIÓN: Crear índice compuesto (patientId, createdAt DESC) para búsqueda rápida
    // COMPATIBILIDAD: No afecta queries existentes, solo mejora performance de getAllPatients
    
    await queryInterface.addIndex('Derivations', ['patientId', 'createdAt'], {
      name: 'idx_derivations_patientId_createdAt',
      order: [['createdAt', 'DESC']], // Orden descendente para obtener última derivación rápidamente
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('Derivations', 'idx_derivations_patientId_createdAt');
  }
};
