'use strict';
const { Derivation, Patient, User } = require('../../models');
const { toDerivationDTOList } = require('../../mappers/DerivationMapper');
const logger = require('../utils/logger');
const { sendSuccess, sendError } = require('../utils/response');

const getDerivations = async (req, res) => {
  try {
    const { professionalId } = req.query;

    const where = {};
    if (professionalId) {
      where.professionalId = professionalId;
    }

    const derivations = await Derivation.findAll({
      where,
      include: [
        {
          model: Patient,
          as: 'patient',
          attributes: ['name'],
          required: false,
        },
        {
          model: User,
          as: 'professional',
          attributes: ['name'],
          required: false,
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    return sendSuccess(res, { derivations: toDerivationDTOList(derivations) });
  } catch (error) {
    logger.error('Error al obtener derivaciones:', error);
    return sendError(res, 500, 'Error al obtener las derivaciones');
  }
};

module.exports = {
  getDerivations,
};

