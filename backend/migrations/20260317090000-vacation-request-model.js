'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('VacationRequests', {
      id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },

      professionalId: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },

      startDate: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },

      endDate: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },

      weeksRequested: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      reason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      status: {
        type: Sequelize.ENUM('pending', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
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

    await queryInterface.addIndex('VacationRequests', ['professionalId'], {
      name: 'idx_vacation_professionalId',
    });

    await queryInterface.addIndex('VacationRequests', ['professionalId', 'status'], {
      name: 'idx_vacation_professional_status',
    });

    await queryInterface.addIndex(
      'VacationRequests',
      ['professionalId', 'startDate', 'endDate', 'status'],
      {
        name: 'idx_vacation_professional_range_status',
      }
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex(
      'VacationRequests',
      'idx_vacation_professional_range_status'
    );
    await queryInterface.removeIndex(
      'VacationRequests',
      'idx_vacation_professional_status'
    );
    await queryInterface.removeIndex(
      'VacationRequests',
      'idx_vacation_professionalId'
    );
    await queryInterface.dropTable('VacationRequests');
  },
};

