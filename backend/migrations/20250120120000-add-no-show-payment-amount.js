'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Esta migración se creó para agregar la columna noShowPaymentAmount
    // en bases ya existentes. En una base recién creada (migraciones desde cero),
    // la tabla Appointments todavía no existe cuando corre esta migración,
    // por lo que debemos hacerla segura y saltearla si la tabla no está.

    const [appointmentsTable] = await queryInterface.sequelize.query(`
      SHOW TABLES LIKE 'Appointments';
    `);

    if (!appointmentsTable.length) {
      console.log(
        '[20250120120000-add-no-show-payment-amount] Tabla Appointments no existe, se omite addColumn.'
      );
      return;
    }

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

