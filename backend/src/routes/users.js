const express = require('express');
const router = express.Router();
const { verifyToken } = require('../controllers/authController');
const { getUserById, getUsers, createUser, updateUser, deleteUser, permanentDeleteUser, abonarComision, getAbonos, getProfessionals } = require('../controllers/userController');
const validate = require('../middleware/validate');
const userValidators = require('../validators/userValidator');

// Proteger todas las rutas
router.use(verifyToken);

// Obtener todos los usuarios
router.get('/', getUsers);

// Obtener todos los profesionales
router.get('/professionals', getProfessionals);

// Obtener todos los abonos individuales
router.get('/abonos', getAbonos);

// Obtener todos los usuarios
router.get('/:id', validate(userValidators.getById), getUserById);

// Crear un nuevo usuario
router.post('/', validate(userValidators.create), createUser);

// Actualizar un usuario
router.put('/:id', validate(userValidators.update), updateUser);

// Eliminar un usuario (soft delete - desactivar)
router.delete('/:id', validate(userValidators.delete), deleteUser);

// Eliminar permanentemente un usuario (solo usuarios inactivos)
router.delete('/:id/permanent', validate(userValidators.delete), permanentDeleteUser);

// Abonar comisión a un profesional
router.post('/:id/abonar-comision', validate(userValidators.abonarComision), abonarComision);

module.exports = router; 