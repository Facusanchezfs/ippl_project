'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Posts', 'description', {
      type: Sequelize.TEXT,
      allowNull: true,
      after: 'excerpt', // Colocar después del campo excerpt
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Posts', 'description');
  },
};

