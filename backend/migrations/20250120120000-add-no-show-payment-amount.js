'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Appointments', 'noShowPaymentAmount', {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: true,
      after: 'paymentAmount', // MySQL specific, se ignora en otros DBs
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Appointments', 'noShowPaymentAmount');
  },
};

