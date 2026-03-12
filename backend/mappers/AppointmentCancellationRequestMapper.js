'use strict';
const AppointmentCancellationRequestDTO = require('../dtos/AppointmentCancellationRequestDTO');

function toAppointmentCancellationRequestDTO(source) {
  return new AppointmentCancellationRequestDTO(source);
}

function toAppointmentCancellationRequestDTOList(list) {
  return list.map(toAppointmentCancellationRequestDTO);
}

module.exports = {
  toAppointmentCancellationRequestDTO,
  toAppointmentCancellationRequestDTOList,
};

