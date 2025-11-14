'use strict'
const express = require('express');
const router = express.Router();
const { User } = require('../../models');
const { toProfessionalDTOList } = require('../../mappers/ProfessionalMapper');
const logger = require('../utils/logger');

// GET /api/professionals - Obtener todos los profesionales
router.get('/', async (req, res) => {
  try {
    const professionals = await User.findAll({
      where: { role: 'professional' },
      attributes: ['id', 'name', 'email', 'role', 'speciality'],
      order: [['name', 'ASC']],
    });

    return res.json({ professionals: toProfessionalDTOList(professionals) });
  } catch (error) {
    logger.error('Error al obtener profesionales:', error);
    return res.status(500).json({ message: 'Error al obtener los profesionales' });
  }
});

module.exports = router; 