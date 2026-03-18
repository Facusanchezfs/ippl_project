'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Actualizar ENUM de Patients.sessionFrequency para incluir 'twice_weekly'
    await queryInterface.changeColumn('Patients', 'sessionFrequency', {
      type: Sequelize.ENUM('weekly', 'biweekly', 'monthly', 'twice_weekly'),
      allowNull: true,
    });

    // Actualizar ENUM de Derivations.sessionFrequency para incluir 'twice_weekly'
    await queryInterface.changeColumn('Derivations', 'sessionFrequency', {
      type: Sequelize.ENUM('weekly', 'biweekly', 'monthly', 'twice_weekly'),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    // Volver al ENUM anterior (sin 'twice_weekly') en Patients
    await queryInterface.changeColumn('Patients', 'sessionFrequency', {
      type: Sequelize.ENUM('weekly', 'biweekly', 'monthly'),
      allowNull: true,
    });

    // Volver al ENUM anterior (sin 'twice_weekly') en Derivations
    await queryInterface.changeColumn('Derivations', 'sessionFrequency', {
      type: Sequelize.ENUM('weekly', 'biweekly', 'monthly'),
      allowNull: true,
    });
  },
};

