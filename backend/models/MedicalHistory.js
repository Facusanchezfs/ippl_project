'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class MedicalHistory extends Model {
    static associate(models) {
      MedicalHistory.belongsTo(models.Patient, {
        foreignKey: 'patientId',
        as: 'patient',
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      });

      MedicalHistory.belongsTo(models.User, {
        foreignKey: 'professionalId',
        as: 'professional',
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }
  }

  MedicalHistory.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      patientId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      professionalId: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      diagnosis: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      treatment: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'MedicalHistory',
      tableName: 'MedicalHistories',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    }
  );

  return MedicalHistory;
};
