'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Patients', 'sessionCost', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: null,
      after: 'sessionFrequency',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Patients', 'sessionCost');
  },
};
