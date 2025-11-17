'use strict';
const bcrypt = require('bcryptjs');
const { User, Abono, sequelize } = require('../../models');
const { toUserDTO } = require('../../mappers/UserMapper');
const { toAbonoDTOList } = require('../../mappers/AbonoMapper');
const logger = require('../utils/logger');
const { sendSuccess, sendError } = require('../utils/response');

// helper numérico para DECIMAL
function toAmount(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round2(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}

// Get user by id

const getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findByPk(id);
    if (!user) {
      return sendError(res, 404, 'Usuario no encontrado');
    }
    const dtos = toUserDTO(user);
    return sendSuccess(res, dtos);
  } catch (error) {
    logger.error('Error getting user:', error);
    return sendError(res, 500, 'Error al obtener usuario');
  }
};

const getProfessionals = async (req, res) => {
  try {
    const professionals = await User.findAll({ where: { role: 'professional' } });
    const dtos = professionals.map(x => toUserDTO(x));
    return sendSuccess(res, dtos);
  } catch (error) {
    logger.error('Error getting professionals:', error);
    return sendError(res, 500, 'Error al obtener profesionales');
  }
};
// Get all users
const getUsers = async (req, res) => {
  try {
    const users = await User.findAll({ order: [['id', 'ASC']] });
    const dtos = users.map((u) => toUserDTO(u));
    return sendSuccess(res, { users: dtos });
  } catch (error) {
    logger.error('Error getting users:', error);
    return sendError(res, 500, 'Error al obtener usuarios');
  }
};

// Create a new user
const createUser = async (req, res) => {
  try {
    const { name, email, password, role, status, commission, saldoTotal, saldoPendiente } = req.body;

    if (!name || !email || !password || !role) {
      return sendError(res, 400, 'Todos los campos (name, email, password, role) son requeridos');
    }

    const exists = await User.findOne({ where: { email } });
    if (exists) return sendError(res, 409, 'El email ya está registrado');

    const salt = await bcrypt.genSalt(10);
    const passwordHashed = await bcrypt.hash(password, salt);

    // Asegurar que commission sea un número válido
    const commissionValue = (typeof commission === 'number' && !isNaN(commission)) ? commission : 0;
    
    const created = await User.create({
      name,
      email,
      password: passwordHashed,
      role,
      status: status ?? 'active',
      commission: commissionValue,
      saldoTotal: saldoTotal || 0,
      saldoPendiente: saldoPendiente || 0,
    });

    return sendSuccess(res, toUserDTO(created), 'Usuario creado correctamente', 201);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return sendError(res, 409, 'El email ya está registrado');
    }
    logger.error('Error creating user:', error);
    return sendError(res, 500, 'Error al crear usuario');
  }
};

// Update a user
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) return sendError(res, 404, 'Usuario no encontrado');

    const data = { ...req.body };

    if (Object.prototype.hasOwnProperty.call(data, 'password')) {
      if (!data.password) {
        return sendError(res, 400, 'La contraseña no puede ser vacía');
      }
      const salt = await bcrypt.genSalt(10);
      data.password = await bcrypt.hash(data.password, salt);
    }

    const allowed = ['name', 'email', 'role', 'status', 'password', 'commission', 'saldoTotal', 'saldoPendiente', 'lastLogin'];
    const payload = {};
    for (const k of allowed) if (data[k] !== undefined) payload[k] = data[k];

    if (payload.saldoTotal !== undefined) {
      payload.saldoTotal = round2(toAmount(payload.saldoTotal));
    }

    const commissionWasProvided = Object.prototype.hasOwnProperty.call(payload, 'commission');
    if (commissionWasProvided) {
      const newCommission = round2(toAmount(payload.commission));
      payload.commission = newCommission;

      if (user.role === 'professional') {
        const baseTotal = payload.saldoTotal !== undefined
          ? payload.saldoTotal
          : round2(toAmount(user.saldoTotal));

        payload.saldoPendiente = round2(baseTotal * (newCommission / 100));
      }
    }

    await user.update(payload);

    await user.reload();
    return sendSuccess(res, toUserDTO(user), 'Usuario actualizado correctamente');
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return sendError(res, 409, 'El email ya está registrado');
    }
    logger.error('Error updating user:', error);
    return sendError(res, 500, 'Error al actualizar usuario');
  }
};

// Delete a user (soft delete - desactivar)
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) return sendError(res, 404, 'Usuario no encontrado');

    if (user.status === 'inactive') {
      return sendSuccess(res, { user: toUserDTO(user) }, 'El usuario ya estaba inactivo');
    }

    await user.update({ status: 'inactive' });
    await user.reload();

    return sendSuccess(res, { user: toUserDTO(user) }, 'Usuario desactivado correctamente');
  } catch (error) {
    logger.error('Error deleting user:', error);
    return sendError(res, 500, 'Error al desactivar usuario');
  }
};

// Permanent delete a user (eliminación física)
const permanentDeleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) return sendError(res, 404, 'Usuario no encontrado');

    // Solo permitir eliminar usuarios inactivos
    if (user.status === 'active') {
      return sendError(res, 400, 'No se puede eliminar permanentemente un usuario activo. Primero debe desactivarlo.');
    }

    await user.destroy();

    return sendSuccess(res, null, 'Usuario eliminado permanentemente', 204);
  } catch (error) {
    logger.error('Error permanently deleting user:', error);
    return sendError(res, 500, 'Error al eliminar usuario permanentemente');
  }
};

// Abonar comisión a un profesional
const abonarComision = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { abono } = req.body;

    const amount = Number(abono);
    if (!amount || isNaN(amount) || amount <= 0) {
      await t.rollback();
      return sendError(res, 400, 'Abono inválido');
    }

    // lock para evitar race conditions en saldo
    const professional = await User.findOne({
      where: { id, role: 'professional' },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!professional) {
      await t.rollback();
      return sendError(res, 404, 'Profesional no encontrado');
    }

    const prevSaldo = toAmount(professional.saldoPendiente);
    const rawNext = prevSaldo - amount;

    // clamp a 0
    const nextSaldo = rawNext <= 0 ? 0 : +rawNext.toFixed(2);
    const paidInFull = nextSaldo === 0 && prevSaldo > 0;

    // Actualiza saldoPendiente y, si corresponde, saldoTotal
    await professional.update(
      {
        saldoPendiente: nextSaldo,
        saldoTotal: paidInFull ? 0 : professional.saldoTotal,
        updatedAt: new Date(),
      },
      { transaction: t }
    );

    // Registrar el abono
    await Abono.create(
      {
        professionalId: professional.id,
        professionalName: professional.name, // snapshot
        amount: +amount.toFixed(2),
        date: new Date(),
      },
      { transaction: t }
    );

    await t.commit();
    return sendSuccess(res, {
      saldoPendiente: nextSaldo,
      paidInFull, // booleano para que el cliente muestre alerta
    }, 'Comisión abonada correctamente');
  } catch (error) {
    await t.rollback();
    logger.error('Error al abonar comisión:', error);
    return sendError(res, 500, 'Error al abonar comisión');
  }
};

// Obtener todos los abonos individuales
const getAbonos = async (req, res) => {
  try {
    const abonos = await Abono.findAll({
      order: [
        ['date', 'DESC'],
        ['createdAt', 'DESC'],
      ],
    });

    return sendSuccess(res, { abonos: toAbonoDTOList(abonos) });
  } catch (error) {
    logger.error('Error al obtener abonos:', error);
    return sendError(res, 500, 'Error al obtener abonos');
  }
};

module.exports = {
  getUserById,
  getProfessionals,
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  permanentDeleteUser,
  abonarComision,
  getAbonos
};