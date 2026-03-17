'use strict';
const VacationRequestDTO = require('../dtos/VacationRequestDTO');

function toVacationRequestDTO(source) {
  return new VacationRequestDTO(source);
}

function toVacationRequestDTOList(list) {
  return list.map(toVacationRequestDTO);
}

module.exports = { toVacationRequestDTO, toVacationRequestDTOList };

