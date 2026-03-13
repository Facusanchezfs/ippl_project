'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Permitir que professionalId sea NULL en Derivations
    await queryInterface.changeColumn('Derivations', 'professionalId', {
      type: Sequelize.BIGINT,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    // Revertir: volver a exigir NOT NULL (solo si todos los registros tienen valor)
    await queryInterface.changeColumn('Derivations', 'professionalId', {
      type: Sequelize.BIGINT,
      allowNull: false,
    });
  },
};

