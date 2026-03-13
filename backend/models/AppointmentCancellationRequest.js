'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AppointmentCancellationRequest extends Model {
    static associate(models) {
      AppointmentCancellationRequest.belongsTo(models.Appointment, {
        foreignKey: 'appointmentId',
        as: 'appointment',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });

      AppointmentCancellationRequest.belongsTo(models.User, {
        foreignKey: 'professionalId',
        as: 'professional',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });

      AppointmentCancellationRequest.belongsTo(models.User, {
        foreignKey: 'reviewedBy',
        as: 'reviewer',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
    }
  }

  AppointmentCancellationRequest.init(
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },

      appointmentId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },

      professionalId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },

      reason: {
        type: DataTypes.TEXT,
        allowNull: false,
      },

      status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
      },

      reviewedBy: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },

      reviewedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'AppointmentCancellationRequest',
      tableName: 'AppointmentCancellationRequests',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    }
  );

  return AppointmentCancellationRequest;
};

