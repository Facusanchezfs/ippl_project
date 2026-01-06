'use strict';

class MedicalHistoryDTO {
  constructor(source) {
    const mh =
      typeof source.get === 'function' ? source.get({ plain: true }) : source;

    this.id = String(mh.id);
    this.patientId = String(mh.patientId);
    this.professionalId = mh.professionalId != null ? String(mh.professionalId) : '';
    this.date = mh.date;
    this.diagnosis = mh.diagnosis;
    this.treatment = mh.treatment;
    this.notes = mh.notes;
    this.createdAt = new Date(mh.createdAt).toISOString();
    this.updatedAt = new Date(mh.updatedAt).toISOString();
  }
}

module.exports = MedicalHistoryDTO;
