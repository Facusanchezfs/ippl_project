'use strict';
const DerivationDTO = require('../dtos/DerivationDTO');

function toDerivationDTO(source) {
  return new DerivationDTO(source);
}

function toDerivationDTOList(list) {
  return list.map(toDerivationDTO);
}

module.exports = { toDerivationDTO, toDerivationDTOList };

