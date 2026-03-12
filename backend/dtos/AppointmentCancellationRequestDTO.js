'use strict';

function toIso(v) {
  if (!v) return undefined;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

class AppointmentCancellationRequestDTO {
  constructor(source) {
    const a =
      typeof source.get === 'function' ? source.get({ plain: true }) : source;

    this.id = String(a.id);

    this.appointmentId =
      a.appointmentId != null ? String(a.appointmentId) : undefined;

    this.professionalId =
      a.professionalId != null ? String(a.professionalId) : undefined;

    this.reason = a.reason ?? '';
    this.status = a.status;

    this.reviewedBy =
      a.reviewedBy != null ? String(a.reviewedBy) : undefined;
    this.reviewedAt = toIso(a.reviewedAt);

    this.createdAt = toIso(a.createdAt);
    this.updatedAt = toIso(a.updatedAt);
  }
}

module.exports = AppointmentCancellationRequestDTO;

