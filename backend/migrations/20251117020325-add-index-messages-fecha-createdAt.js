'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // OPTIMIZACIÓN FASE 3 PARTE 2: Índice para getAllMessages
    // PROBLEMA: Query sin índice optimizado para ORDER BY (fecha DESC, createdAt DESC)
    // IMPACTO: Escaneo completo de tabla en lugar de usar índice
    // SOLUCIÓN: Crear índice compuesto (fecha DESC, createdAt DESC)
    // COMPATIBILIDAD: No afecta queries existentes, solo mejora performance
    
    await queryInterface.addIndex('Messages', ['fecha', 'createdAt'], {
      name: 'idx_messages_fecha_createdAt',
      order: [['fecha', 'DESC'], ['createdAt', 'DESC']], // Orden descendente para ORDER BY optimizado
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('Messages', 'idx_messages_fecha_createdAt');
  }
};
