'use strict';

function toIso(value) {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

class ActivityDTO {
  constructor({
    id,
    type,
    title,
    description,
    occurredAt,
    metadata,
    read,
    patientId,
    professionalId,
  }) {
    this._id = String(id);
    this.type = type;
    this.title = title;
    this.description = description;
    this.date  = toIso(occurredAt);
    this.read = !!read;
    const enrichedMetadata = metadata ? { ...metadata } : {};
    if (patientId && !enrichedMetadata.patientId) {
      enrichedMetadata.patientId = String(patientId);
    }
    if (professionalId && !enrichedMetadata.professionalId) {
      enrichedMetadata.professionalId = String(professionalId);
    }
    this.metadata = Object.keys(enrichedMetadata).length > 0 ? enrichedMetadata : undefined;
    this.id = this._id;
    this.createdAt = this.date;
  }
}

module.exports = ActivityDTO;
