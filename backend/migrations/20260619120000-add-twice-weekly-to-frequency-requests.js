'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Actualizar ENUM de currentFrequency para incluir 'twice_weekly'
    await queryInterface.changeColumn('FrequencyRequests', 'currentFrequency', {
      type: Sequelize.ENUM('weekly', 'biweekly', 'monthly', 'twice_weekly'),
      allowNull: false,
    });

    // Actualizar ENUM de requestedFrequency para incluir 'twice_weekly'
    await queryInterface.changeColumn('FrequencyRequests', 'requestedFrequency', {
      type: Sequelize.ENUM('weekly', 'biweekly', 'monthly', 'twice_weekly'),
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    // Volver al ENUM anterior (sin 'twice_weekly')
    await queryInterface.changeColumn('FrequencyRequests', 'currentFrequency', {
      type: Sequelize.ENUM('weekly', 'biweekly', 'monthly'),
      allowNull: false,
    });

    await queryInterface.changeColumn('FrequencyRequests', 'requestedFrequency', {
      type: Sequelize.ENUM('weekly', 'biweekly', 'monthly'),
      allowNull: false,
    });
  },
};
