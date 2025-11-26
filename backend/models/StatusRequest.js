'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class StatusRequest extends Model {
    static associate(models) {
      StatusRequest.belongsTo(models.Patient, {
        foreignKey: 'patientId',
        as: 'patient',
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      });
      StatusRequest.belongsTo(models.User, {
        foreignKey: 'professionalId',
        as: 'professional',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
    }
  }

  StatusRequest.init(
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },

      // Identificación (FKs + snapshots para auditoría)
      patientId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      patientName: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },
      professionalId: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      professionalName: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },

      type: {
        type: DataTypes.ENUM('activation', 'status_change'),
        allowNull: false,
        defaultValue: 'status_change',
      },

      // Estados del paciente (vigente y solicitado)
      currentStatus: {
        type: DataTypes.ENUM('active', 'pending', 'inactive'),
        allowNull: false,
      },
      requestedStatus: {
        type: DataTypes.ENUM('active', 'pending', 'inactive'),
        allowNull: false,
      },

      // Motivo de la solicitud
      reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      // Estado del trámite de solicitud
      status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
      },

      // Respuesta/comentario del admin (cuando se aprueba/rechaza)
      adminResponse: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'StatusRequest',
      tableName: 'StatusRequests',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    }
  );

  return StatusRequest;
};
