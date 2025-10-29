'use strict';
const bcrypt = require('bcryptjs');
const { User, Abono, sequelize } = require('../../models');
const { toUserDTO } = require('../../mappers/UserMapper');
const { toAbonoDTOList } = require('../../mappers/AbonoMapper');

// helper numérico para DECIMAL
function toAmount(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Get user by id

const getUserById = async (req, res) => {
  const { id } = req.params;
try {
    const user = await User.findByPk(id);
    const dtos = toUserDTO(user);
    res.json(dtos);
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ message: 'Error al obtener usuario' });
  }
}

const getProfessionals = async (req, res) =>{
  try{
    const professionals = await User.findAll({where: {role: 'professional'}})
    const dtos = professionals.map(x => toUserDTO(x));
    res.json(dtos);
  } catch (error) {
    console.error('Error getting professionals:', error);
    res.status(500).json({ message: 'Error al obtener profesionales' });
  }
}
// Get all users
const getUsers = async (req, res) => {
  try {
    const users = await User.findAll({ order: [['id', 'ASC']] });
    const dtos = users.map((u) => toUserDTO(u));
    res.json({ users: dtos });
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ message: 'Error al obtener usuarios' });
  }
}

// Create a new user
const createUser = async (req, res) => {
  try {
    const { name, email, password, role, status, commission, saldoTotal, saldoPendiente } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'Todos los campos (name, email, password, role) son requeridos' });
    }

    const exists = await User.findOne({ where: { email } });
    if (exists) return res.status(409).json({ message: 'El email ya está registrado' });

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

    return res.status(201).json(toUserDTO(created));
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'El email ya está registrado' });
    }
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Error al crear usuario' });
  }
};

// Update a user
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    const data = { ...req.body };

    if (Object.prototype.hasOwnProperty.call(data, 'password')) {
      if (!data.password) {
        return res.status(400).json({ message: 'La contraseña no puede ser vacía' });
      }
      const salt = await bcrypt.genSalt(10);
      data.password = await bcrypt.hash(data.password, salt);
    }

    const allowed = ['name', 'email', 'role', 'status', 'password', 'commission', 'saldoTotal', 'saldoPendiente', 'lastLogin'];
    const payload = {};
    for (const k of allowed) if (data[k] !== undefined) payload[k] = data[k];

    await user.update(payload);

    await user.reload();
    return res.json(toUserDTO(user));
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'El email ya está registrado' });
    }
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Error al actualizar usuario' });
  }
};

// Delete a user
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    if (user.status === 'inactive') {
      return res.json({ message: 'El usuario ya estaba inactivo', user: toUserDTO(user) });
    }

    await user.update({ status: 'inactive' });
    await user.reload();

    return res.json({ message: 'Usuario desactivado correctamente', user: toUserDTO(user) });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Error al desactivar usuario' });
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
      return res.status(400).json({ message: 'Abono inválido' });
    }

    // lock para evitar race conditions en saldo
    const professional = await User.findOne({
      where: { id, role: 'professional' },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!professional) {
      await t.rollback();
      return res.status(404).json({ message: 'Profesional no encontrado' });
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
    return res.json({
      success: true,
      saldoPendiente: nextSaldo,
      paidInFull, // booleano para que el cliente muestre alerta
    });
  } catch (error) {
    await t.rollback();
    console.error('Error al abonar comisión:', error);
    return res.status(500).json({ message: 'Error al abonar comisión' });
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

    return res.json({ abonos: toAbonoDTOList(abonos) });
  } catch (error) {
    console.error('Error al obtener abonos:', error);
    return res.status(500).json({ message: 'Error al obtener abonos' });
  }
};

module.exports = {
  getUserById,
  getProfessionals,
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  abonarComision,
  getAbonos
};