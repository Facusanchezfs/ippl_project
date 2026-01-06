'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class FrequencyRequest extends Model {
    static associate(models) {
      FrequencyRequest.belongsTo(models.Patient, {
        foreignKey: 'patientId',
        as: 'patient',
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      });
      FrequencyRequest.belongsTo(models.User, {
        foreignKey: 'professionalId',
        as: 'professional',
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }
  }

  FrequencyRequest.init(
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
      patientName: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      professionalId: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      professionalName: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      currentFrequency: {
        type: DataTypes.ENUM('weekly', 'biweekly', 'monthly'),
        allowNull: false,
      },
      requestedFrequency: {
        type: DataTypes.ENUM('weekly', 'biweekly', 'monthly'),
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
      adminResponse: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'FrequencyRequest',
      tableName: 'FrequencyRequests',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    }
  );

  return FrequencyRequest;
};
