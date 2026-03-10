'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Appointments', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },

      patientId: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      patientName: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },

      professionalId: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      professionalName: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },

      date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      startTime: {
        type: Sequelize.STRING(5),
        allowNull: false,
      },
      endTime: {
        type: Sequelize.STRING(5),
        allowNull: false,
      },

      type: {
        type: Sequelize.ENUM('regular', 'first_time', 'emergency'),
        allowNull: false,
        defaultValue: 'regular',
      },
      status: {
        type: Sequelize.ENUM('scheduled', 'completed', 'cancelled'),
        allowNull: false,
        defaultValue: 'scheduled',
      },

      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      audioNote: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },

      sessionCost: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
      },
      attended: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
      },
      paymentAmount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
      },
      noShowPaymentAmount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
      },
      remainingBalance: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
      },
      active:{
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },

      completedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal(
          'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
        ),
      },
    });

    await queryInterface.addIndex('Appointments', ['patientId'], {
      name: 'idx_appointments_patientId',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('Appointments', 'idx_appointments_patientId');

    await queryInterface.dropTable('Appointments');
  },
};
