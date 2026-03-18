'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Patients', {
      id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },

      name: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },

      email: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },

      phone: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },

      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      status: {
        type: Sequelize.ENUM('active', 'pending', 'inactive', 'absent', 'alta'),
        allowNull: false,
        defaultValue: 'active',
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

      assignedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      activatedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      sessionFrequency: {
        type: Sequelize.ENUM('weekly', 'biweekly', 'monthly', 'twice_weekly'),
        allowNull: true,
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

    await queryInterface.addIndex('Patients', ['professionalId'], {
      name: 'idx_patients_professionalId',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('Patients', 'idx_patients_professionalId');
    await queryInterface.dropTable('Patients');
  },
};
