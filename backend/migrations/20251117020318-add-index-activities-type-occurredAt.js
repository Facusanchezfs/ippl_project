'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // OPTIMIZACIÓN FASE 3 PARTE 2: Índice para getActivities
    // PROBLEMA: Query sin índice optimizado para WHERE (type IN ...) + ORDER BY (occurredAt DESC)
    // IMPACTO: Escaneo completo de tabla al buscar actividades por tipo
    // SOLUCIÓN: Crear índice compuesto (type, occurredAt DESC)
    // COMPATIBILIDAD: No afecta queries existentes, solo mejora performance
    
    await queryInterface.addIndex('Activities', ['type', 'occurredAt'], {
      name: 'idx_activities_type_occurredAt',
      order: [['occurredAt', 'DESC']], // Orden descendente para ORDER BY optimizado
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('Activities', 'idx_activities_type_occurredAt');
  }
};
