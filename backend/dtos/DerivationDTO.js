'use strict';

function toIso(value) {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

class DerivationDTO {
  constructor(source) {
    const d = typeof source.get === 'function' ? source.get({ plain: true }) : source;

    this.id = String(d.id);
    this.patientId = d.patientId != null ? String(d.patientId) : '';
    this.professionalId = d.professionalId != null ? String(d.professionalId) : '';
    this.createdAt = toIso(d.createdAt);
    this.patientName = d.patient?.name ?? d.patientName ?? '';
    this.professionalName = d.professional?.name ?? d.professionalName ?? '';
  }
}

module.exports = DerivationDTO;

