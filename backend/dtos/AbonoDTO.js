'use strict';

class AbonoDTO {
  constructor(source) {
    const a = typeof source.get === 'function' ? source.get({ plain: true }) : source;

    this.id = String(a.id);
    this.professionalId = a.professionalId != null ? String(a.professionalId) : '';
    this.professionalName = a.professionalName ?? '';
    this.amount = a.amount != null ? Number(a.amount) : 0;
    this.date = a.date ? new Date(a.date).toISOString() : new Date(a.createdAt).toISOString();
  }
}

module.exports = AbonoDTO;
