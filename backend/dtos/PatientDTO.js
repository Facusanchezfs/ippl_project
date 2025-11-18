'use strict';

function toIso(value) {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

class PatientDTO {
  constructor(source) {
    const {
      id,
      name,
      email,
      description,
      status,
      professionalId,
      professionalName,
      createdAt,
      assignedAt,
      activatedAt,
      sessionFrequency,
      textNote,
      audioNote,
      nextAppointment,
      sessionCost,
      statusChangeReason,
      dischargeRequest,
      activationRequest,

    } = typeof source.get === 'function' ? source.get({ plain: true }) : source;

    this.id = String(id);
    this.name = name;
    this.email = email ?? undefined;
    this.description = description ?? undefined;
    this.status = status;
    this.professionalId = professionalId != null ? String(professionalId) : undefined;
    this.professionalName = professionalName ?? undefined;
    this.createdAt = toIso(createdAt);
    this.assignedAt = toIso(assignedAt);
    this.activatedAt = toIso(activatedAt);
    this.sessionFrequency = sessionFrequency ?? undefined;
    this.textNote = textNote ?? undefined;
    this.audioNote = audioNote ?? undefined;
    this.nextAppointment = toIso(nextAppointment);
    this.sessionCost = typeof sessionCost === 'number' ? sessionCost : undefined;
    this.statusChangeReason = statusChangeReason ?? undefined;

    this.dischargeRequest = dischargeRequest ?? undefined;
    this.activationRequest = activationRequest ?? undefined;
  }
}

module.exports = PatientDTO;
