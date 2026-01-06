'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Message extends Model {
    static associate(models) {
    }
  }

  Message.init(
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      nombre: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      apellido: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      correoElectronico: {
        type: DataTypes.STRING(150),
        allowNull: false,
        validate: { isEmail: true },
      },
      mensaje: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      fecha: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      leido: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: 'Message',
      tableName: 'Messages',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    }
  );

  return Message;
};
