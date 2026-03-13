'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Agregar constraint UNIQUE en baseAppointmentId para prevenir duplicados a nivel de BD
    await queryInterface.addConstraint('RecurringAppointments', {
      fields: ['baseAppointmentId'],
      type: 'unique',
      name: 'unique_baseAppointmentId',
    });
  },

  async down(queryInterface, Sequelize) {
    // Remover constraint UNIQUE
    await queryInterface.removeConstraint(
      'RecurringAppointments',
      'unique_baseAppointmentId'
    );
  },
};
