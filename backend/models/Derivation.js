'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Derivation extends Model {
    static associate(models) {
      Derivation.belongsTo(models.Patient, {
        foreignKey: 'patientId',
        as: 'patient',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
      Derivation.belongsTo(models.User, {
        foreignKey: 'professionalId',
        as: 'professional',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      });
    }
  }
  Derivation.init(
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      patientId: {
        type: DataTypes.BIGINT,
        allowNull: false
      },
      professionalId: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      textNote: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      audioNote: {
        type: DataTypes.STRING,
        allowNull: true
      },
      sessionFrequency: {
        type: DataTypes.ENUM('weekly','biweekly','monthly'),
        allowNull: true
      }
    },
    {
      sequelize,
      modelName: 'Derivation',
      tableName: 'Derivations',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt'
    }
  );
  return Derivation;
};