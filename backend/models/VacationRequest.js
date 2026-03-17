'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class VacationRequest extends Model {
    static associate(models) {
      VacationRequest.belongsTo(models.User, {
        foreignKey: 'professionalId',
        as: 'professional',
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      });
    }
  }

  VacationRequest.init(
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },

      professionalId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },

      startDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },

      endDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },

      weeksRequested: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
          max: 4,
        },
      },

      reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
      },
    },
    {
      sequelize,
      modelName: 'VacationRequest',
      tableName: 'VacationRequests',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    }
  );

  return VacationRequest;
};

