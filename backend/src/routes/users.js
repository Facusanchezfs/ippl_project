const express = require('express');
const router = express.Router();
const { verifyToken } = require('../controllers/authController');
const { getUserById, getUsers, createUser, updateUser, deleteUser, permanentDeleteUser, abonarComision, getAbonos, getProfessionals } = require('../controllers/userController');
const validate = require('../middleware/validate');
const userValidators = require('../validators/userValidator');

router.use(verifyToken);

router.get('/', getUsers);

router.get('/professionals', getProfessionals);

router.get('/abonos', getAbonos);

router.get('/:id', validate(userValidators.getById), getUserById);

router.post('/', validate(userValidators.create), createUser);

router.put('/:id', validate(userValidators.update), updateUser);

router.delete('/:id', validate(userValidators.delete), deleteUser);

router.delete('/:id/permanent', validate(userValidators.delete), permanentDeleteUser);

router.post('/:id/abonar-comision', validate(userValidators.abonarComision), abonarComision);

module.exports = router; 