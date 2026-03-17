'use strict';

class VacationRequestDTO {
  constructor(source) {
    const r = typeof source.get === 'function' ? source.get({ plain: true }) : source;

    this.id = String(r.id);
    this.professionalId = String(r.professionalId);
    this.startDate = r.startDate;
    this.endDate = r.endDate;
    this.weeksRequested = Number(r.weeksRequested);
    if (r.reason != null && r.reason !== '') {
      this.reason = r.reason;
    }
    this.status = r.status;

    this.createdAt = new Date(r.createdAt).toISOString();
    if (r.updatedAt) {
      this.updatedAt = new Date(r.updatedAt).toISOString();
    }
  }
}

module.exports = VacationRequestDTO;

