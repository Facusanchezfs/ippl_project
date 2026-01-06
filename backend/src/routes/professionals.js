'use strict'
const express = require('express');
const router = express.Router();
const { User } = require('../../models');
const { toProfessionalDTOList } = require('../../mappers/ProfessionalMapper');
const logger = require('../utils/logger');
const { sendSuccess, sendError } = require('../utils/response');

router.get('/', async (req, res) => {
  try {
    const professionals = await User.findAll({
      where: { role: 'professional' },
      attributes: ['id', 'name', 'email', 'role', 'speciality'],
      order: [['name', 'ASC']],
    });

    return sendSuccess(res, { professionals: toProfessionalDTOList(professionals) });
  } catch (error) {
    logger.error('Error al obtener profesionales:', error);
    return sendError(res, 500, 'Error al obtener los profesionales');
  }
});

module.exports = router; 