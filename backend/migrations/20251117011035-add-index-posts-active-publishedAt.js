'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // OPTIMIZACIÓN CRÍTICA #3: Índice para getAllPosts
    // PROBLEMA: Query sin índice optimizado para ORDER BY (active, publishedAt DESC, createdAt DESC)
    // IMPACTO: Escaneo completo de tabla, especialmente costoso con contenido TEXT
    // SOLUCIÓN: Crear índice compuesto (active, publishedAt DESC, createdAt DESC)
    // COMPATIBILIDAD: No afecta queries existentes, solo mejora performance
    
    await queryInterface.addIndex('Posts', ['active', 'publishedAt', 'createdAt'], {
      name: 'idx_posts_active_publishedAt_createdAt',
      order: [['publishedAt', 'DESC'], ['createdAt', 'DESC']], // Orden descendente para ORDER BY optimizado
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('Posts', 'idx_posts_active_publishedAt_createdAt');
  }
};
