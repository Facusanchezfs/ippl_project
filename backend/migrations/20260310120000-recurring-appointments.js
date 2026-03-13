'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1) Crear tabla RecurringAppointments
    await queryInterface.createTable('RecurringAppointments', {
      id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },

      patientId: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'Patients',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },

      professionalId: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },

      baseAppointmentId: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'Appointments',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },

      frequency: {
        type: Sequelize.ENUM('weekly', 'biweekly', 'monthly'),
        allowNull: false,
      },

      active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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

    // 2) Agregar columna recurringAppointmentId a Appointments
    await queryInterface.addColumn('Appointments', 'recurringAppointmentId', {
      type: Sequelize.BIGINT,
      allowNull: true,
      references: {
        model: 'RecurringAppointments',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface, Sequelize) {
    // Importante: el orden de rollback debe ser:
    // 1) remover la columna que contiene la FK
    // 2) luego eliminar la tabla referenciada

    // 1) Quitar columna recurringAppointmentId de Appointments
    await queryInterface.removeColumn('Appointments', 'recurringAppointmentId');

    // 2) Eliminar tabla RecurringAppointments
    await queryInterface.dropTable('RecurringAppointments');

    // Nota: Sequelize suele gestionar automáticamente la limpieza de ENUMs
    // asociados a tablas al hacer dropTable en algunos dialectos. Si se
    // necesitara una limpieza adicional del tipo ENUM, se podría agregar
    // aquí siguiendo el patrón de otras migraciones del proyecto.
  },
};

