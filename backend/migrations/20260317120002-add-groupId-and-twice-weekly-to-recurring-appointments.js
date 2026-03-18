'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1) Agregar columna groupId (nullable) a RecurringAppointments
    await queryInterface.addColumn('RecurringAppointments', 'groupId', {
      type: Sequelize.STRING,
      allowNull: true,
      // el parámetro "after" es opcional y solo para orden visual en MySQL
    });

    // 2) Actualizar ENUM de frequency para incluir 'twice_weekly'
    await queryInterface.changeColumn('RecurringAppointments', 'frequency', {
      type: Sequelize.ENUM('weekly', 'biweekly', 'monthly', 'twice_weekly'),
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    // 1) Volver al ENUM anterior (sin 'twice_weekly')
    await queryInterface.changeColumn('RecurringAppointments', 'frequency', {
      type: Sequelize.ENUM('weekly', 'biweekly', 'monthly'),
      allowNull: false,
    });

    // 2) Eliminar columna groupId
    await queryInterface.removeColumn('RecurringAppointments', 'groupId');
  },
};

