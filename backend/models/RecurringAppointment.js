'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class RecurringAppointment extends Model {
    static associate(models) {
      RecurringAppointment.belongsTo(models.Patient, {
        foreignKey: 'patientId',
        as: 'patient',
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      });

      RecurringAppointment.belongsTo(models.User, {
        foreignKey: 'professionalId',
        as: 'professional',
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      });

      RecurringAppointment.belongsTo(models.Appointment, {
        as: 'baseAppointment',
        foreignKey: 'baseAppointmentId',
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      });

      RecurringAppointment.hasMany(models.Appointment, {
        foreignKey: 'recurringAppointmentId',
        as: 'occurrences',
      });
    }
  }

  RecurringAppointment.init(
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },

      patientId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },

      professionalId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },

      baseAppointmentId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },

      frequency: {
        type: DataTypes.ENUM('weekly', 'biweekly', 'monthly'),
        allowNull: false,
      },

      active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      sequelize,
      modelName: 'RecurringAppointment',
      tableName: 'RecurringAppointments',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    }
  );

  return RecurringAppointment;
};

