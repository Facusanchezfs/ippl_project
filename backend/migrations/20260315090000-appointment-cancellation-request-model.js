'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('AppointmentCancellationRequests', {
      id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },

      appointmentId: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'Appointments', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },

      professionalId: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },

      reason: {
        type: Sequelize.TEXT,
        allowNull: false,
      },

      status: {
        type: Sequelize.ENUM('pending', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
      },

      reviewedBy: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },

      reviewedAt: {
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

    await queryInterface.addIndex(
      'AppointmentCancellationRequests',
      ['appointmentId'],
      {
        name: 'idx_acr_appointmentId',
      }
    );
    await queryInterface.addIndex(
      'AppointmentCancellationRequests',
      ['status'],
      {
        name: 'idx_acr_status',
      }
    );

    // Índice compuesto optimizado para búsquedas de solicitudes pendientes por cita
    await queryInterface.addIndex(
      'AppointmentCancellationRequests',
      ['appointmentId', 'status'],
      {
        name: 'idx_acr_appointment_pending',
      }
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex(
      'AppointmentCancellationRequests',
      'idx_acr_appointment_pending'
    );
    await queryInterface.removeIndex(
      'AppointmentCancellationRequests',
      'idx_acr_status'
    );
    await queryInterface.removeIndex(
      'AppointmentCancellationRequests',
      'idx_acr_appointmentId'
    );
    await queryInterface.dropTable('AppointmentCancellationRequests');
  },
};

