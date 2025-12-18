'use strict';
const bcrypt = require('bcryptjs');
const { User, Abono, Patient, Appointment, FrequencyRequest, StatusRequest, Activity, sequelize } = require('../../models');
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
    // OPTIMIZACIÓN FASE 3 PARTE 2: getUsers
    // PROBLEMA: Sin paginación, trae todos los usuarios. Password incluido (aunque DTO lo excluye, mejor excluirlo a nivel query).
    // IMPACTO: Con muchos usuarios = transferencia masiva, riesgo de exponer passwords.
    // SOLUCIÓN: Paginación obligatoria + excluir password a nivel query + filtro opcional por status.
    // COMPATIBILIDAD: Formato de respuesta con paginación estándar, mantiene DTO.
    
    const hasLimit = req.query.limit !== undefined;
    const hasPage = req.query.page !== undefined;
    
    // Si solo se pasa limit (sin page), devolver los primeros 'limit' usuarios (truncar array)
    // Si se pasa page y limit, usar paginación normal
    // Si no se pasa nada, devolver todos
    const limit = hasLimit ? parseInt(req.query.limit, 10) : (hasPage ? 20 : null);
    const page = hasPage ? parseInt(req.query.page, 10) : (hasLimit ? 1 : null);
    const status = req.query.status; // Filtro opcional: 'active', 'inactive', 'pending'
    
    if (page !== null && page < 1) return sendError(res, 400, 'page debe ser mayor a 0');
    if (limit !== null && (limit < 1 || limit > 100)) return sendError(res, 400, 'limit debe estar entre 1 y 100');
    
    const where = {};
    if (status) {
      where.status = status;
    }
    
    // Si hay limit, aplicar paginación/truncado
    if (limit !== null) {
      const offset = page !== null ? (page - 1) * limit : 0;
      
      const { count, rows: users } = await User.findAndCountAll({
        where,
        attributes: { exclude: ['password'] }, // Excluir password a nivel query (refuerzo de seguridad)
        order: [['id', 'ASC']],
        limit,
        offset,
      });
      
      const dtos = users.map((u) => toUserDTO(u));
      
      // Si se pasó page, devolver formato con paginación completa
      if (hasPage) {
        const totalPages = Math.ceil(count / limit);
        return sendSuccess(res, {
          users: dtos,
          pagination: {
            page,
            limit,
            total: count,
            totalPages,
          },
        });
      } else {
        // Si solo se pasó limit, devolver formato simple (truncado)
        return sendSuccess(res, { users: dtos });
      }
    } else {
      // Sin limit, devolver todos los usuarios (formato antiguo)
      const users = await User.findAll({
        where,
        attributes: { exclude: ['password'] },
        order: [['id', 'ASC']],
      });
      
      const dtos = users.map((u) => toUserDTO(u));
      return sendSuccess(res, { users: dtos });
    }
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
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    logger.info(`[permanentDeleteUser] Iniciando eliminación permanente del usuario ${id}`);

    // Buscar usuario dentro de la transacción
    const user = await User.findByPk(id, { transaction: t });
    if (!user) {
      await t.rollback();
      logger.warn(`[permanentDeleteUser] Usuario ${id} no encontrado`);
      return sendError(res, 404, 'Usuario no encontrado');
    }

    // Validar que el usuario esté inactivo
    if (user.status === 'active') {
      await t.rollback();
      logger.warn(`[permanentDeleteUser] Intento de eliminar usuario activo ${id}`);
      return sendError(res, 400, 'No se puede eliminar permanentemente un usuario activo. Primero debe desactivarlo.');
    }

    logger.info(`[permanentDeleteUser] Usuario ${id} validado como inactivo, iniciando limpieza de referencias`);

    // ===== LIMPIEZA DE REFERENCIAS =====

    // a) Pacientes asignados
    const patients = await Patient.findAll({
      where: {
        professionalId: user.id,
        active: true
      },
      transaction: t
    });

    if (patients.length > 0) {
      logger.info(`[permanentDeleteUser] Limpiando ${patients.length} pacientes asignados`);
      await Promise.all(
        patients.map(patient =>
          patient.update({
            professionalId: null,
            professionalName: null,
            status: 'pending',
            assignedAt: null
          }, { transaction: t })
        )
      );
    }

    // b) Appointments activos o futuros
    const appointments = await Appointment.findAll({
      where: {
        professionalId: user.id,
        active: true,
        status: 'scheduled'
      },
      transaction: t
    });

    if (appointments.length > 0) {
      logger.info(`[permanentDeleteUser] Cancelando ${appointments.length} citas programadas`);
      await Promise.all(
        appointments.map(appointment =>
          appointment.update({
            professionalId: null,
            professionalName: null,
            status: 'cancelled',
            active: false
          }, { transaction: t })
        )
      );
    }

    // c) FrequencyRequests pendientes
    const frequencyRequests = await FrequencyRequest.findAll({
      where: {
        professionalId: user.id,
        status: 'pending'
      },
      transaction: t
    });

    if (frequencyRequests.length > 0) {
      logger.info(`[permanentDeleteUser] Rechazando ${frequencyRequests.length} solicitudes de frecuencia pendientes`);
      await Promise.all(
        frequencyRequests.map(request =>
          request.update({
            professionalId: null,
            professionalName: '[usuario eliminado]',
            status: 'rejected',
            adminResponse: 'Profesional eliminado del sistema'
          }, { transaction: t })
        )
      );
    }

    // d) StatusRequests pendientes
    const statusRequests = await StatusRequest.findAll({
      where: {
        professionalId: user.id,
        status: 'pending'
      },
      transaction: t
    });

    if (statusRequests.length > 0) {
      logger.info(`[permanentDeleteUser] Rechazando ${statusRequests.length} solicitudes de estado pendientes`);
      await Promise.all(
        statusRequests.map(request =>
          request.update({
            professionalId: null,
            professionalName: '[usuario eliminado]',
            status: 'rejected',
            adminResponse: 'Profesional eliminado del sistema'
          }, { transaction: t })
        )
      );
    }

    // e) Derivations asociadas al profesional
    // Nota: La columna professionalId tiene NOT NULL constraint en la base de datos,
    // por lo que no podemos ponerla en NULL. Eliminamos las derivaciones para resolver
    // el foreign key constraint.
    const [derivationResults] = await sequelize.query(
      `DELETE FROM Derivations WHERE professionalId = :userId`,
      {
        replacements: { userId: user.id },
        transaction: t
      }
    );

    if (derivationResults > 0) {
      logger.info(`[permanentDeleteUser] Eliminando ${derivationResults} derivaciones asociadas`);
    }

    // f) Activities asociadas al profesional
    // REGLA DE NEGOCIO: Las activities NO deben sobrevivir a la eliminación del profesional
    // Eliminación física (DELETE) de todas las activities del profesional
    const deletedActivitiesCount = await Activity.destroy({
      where: {
        professionalId: user.id
      },
      transaction: t
    });

    if (deletedActivitiesCount > 0) {
      logger.info(`[permanentDeleteUser] Eliminando ${deletedActivitiesCount} activities asociadas al profesional`);
    }

    // ===== ELIMINACIÓN FINAL =====
    logger.info(`[permanentDeleteUser] Eliminando usuario ${id} permanentemente`);
    await user.destroy({ transaction: t });

    // Confirmar transacción
    await t.commit();
    logger.info(`[permanentDeleteUser] Usuario ${id} eliminado permanentemente con éxito`);

    return sendSuccess(res, null, undefined, 204);
  } catch (error) {
    await t.rollback();
    logger.error('[permanentDeleteUser] Error al eliminar usuario permanentemente:', error);
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