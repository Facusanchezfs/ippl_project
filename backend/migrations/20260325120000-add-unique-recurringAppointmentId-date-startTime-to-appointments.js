'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addConstraint('Appointments', {
      fields: ['recurringAppointmentId', 'date', 'startTime'],
      type: 'unique',
      name: 'unique_recurringAppointmentId_date_startTime',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint(
      'Appointments',
      'unique_recurringAppointmentId_date_startTime'
    );
  },
};

