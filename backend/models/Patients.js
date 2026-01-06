'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Patient extends Model {
    static associate(models) {
      Patient.belongsTo(models.User, {
        foreignKey: 'professionalId',
        as: 'professional',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
    	});

      Patient.hasMany(models.MedicalHistory, {
        foreignKey: 'patientId',
        as: 'medicalHistories',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    	});

      Patient.hasMany(models.Derivation, {
        foreignKey: 'patientId',
        as: 'derivations',
    	});

      Patient.hasMany(models.Appointment, { 
		foreignKey: 'patientId', 
		as: 'appointments' 
		});
    }
  }

  Patient.init(
    {
      id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },

      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },

      email: {
        type: DataTypes.STRING(150),
        allowNull: true,
        validate: { isEmail: true },
      },

      phone: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },

      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      status: {
        type: DataTypes.ENUM('active', 'pending', 'inactive'),
        allowNull: false,
        defaultValue: 'active',
      },

      professionalId: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },

      professionalName: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },

      assignedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      activatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      sessionFrequency: {
        type: DataTypes.ENUM('weekly', 'biweekly', 'monthly'),
        allowNull: true,
      },

      active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      sequelize,
      modelName: 'Patient',
      tableName: 'Patients',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    }
  );

  return Patient;
};
