'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Appointment extends Model {
    static associate(models) {
      Appointment.belongsTo(models.Patient, {
        foreignKey: 'patientId',
        as: 'patient',
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      });
      Appointment.belongsTo(models.User, {
        foreignKey: 'professionalId',
        as: 'professional',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
    }
  }

  Appointment.init(
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },

      patientId: {
        type: DataTypes.BIGINT,
        allowNull: true,
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

      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      startTime: {
        type: DataTypes.STRING(5),
        allowNull: false,
      },
      endTime: {
        type: DataTypes.STRING(5),
        allowNull: false,
      },

      type: {
        type: DataTypes.ENUM('regular', 'first_time', 'emergency'),
        allowNull: false,
        defaultValue: 'regular',
      },
      status: {
        type: DataTypes.ENUM('scheduled', 'completed', 'cancelled'),
        allowNull: false,
        defaultValue: 'scheduled',
      },

      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      audioNote: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },

      sessionCost: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },
      attended: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
      paymentAmount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },
      noShowPaymentAmount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },
      remainingBalance: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },

      completedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
    },
    {
      sequelize,
      modelName: 'Appointment',
      tableName: 'Appointments',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      hooks: {
        beforeCreate(appt) {
          if (appt.status === 'completed') {
            appt.completedAt = new Date();
          } else {
            appt.completedAt = null;
          }
        },
        beforeUpdate(appt) {
          if (appt.changed('status')) {
            if (appt.status === 'completed') {
              if (!appt.completedAt) appt.completedAt = new Date();
            } else if (appt.status === 'scheduled' || appt.status === 'cancelled') {
              appt.completedAt = null;
            }
          }
        },
      },
      validate: {
        timeOrder() {
          const toMinutes = (hhmm) => {
            const [h, m] = String(hhmm || '').split(':').map((x) => parseInt(x, 10));
            return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
          };
          if (toMinutes(this.endTime) <= toMinutes(this.startTime)) {
            throw new Error('endTime debe ser mayor que startTime');
          }
        },
      },
    }
  );

  return Appointment;
};
