'use strict';

function toIso(value) {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

function toNum(v) {
  if (v === null || v === undefined) return undefined;
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

class AppointmentDTO {
  constructor(src) {
    const a = typeof src.get === 'function' ? src.get({ plain: true }) : src;

    this.id = String(a.id);

    this.patientId = a.patientId != null ? String(a.patientId) : '';
    this.patientName = a.patientName ?? '';

    this.professionalId = a.professionalId != null ? String(a.professionalId) : '';
    this.professionalName = a.professionalName ?? '';

    this.date = a.date;
    this.startTime = a.startTime;
    this.endTime = a.endTime;

    this.type = a.type;
    this.status = a.status;

    this.notes = a.notes ?? undefined;
    this.audioNote = a.audioNote ?? undefined;

    this.sessionCost = toNum(a.sessionCost);
    this.attended = a.attended ?? undefined;
    this.paymentAmount = toNum(a.paymentAmount);
    this.noShowPaymentAmount = toNum(a.noShowPaymentAmount);
    this.remainingBalance = toNum(a.remainingBalance);

    this.completedAt = toIso(a.completedAt);
    this.createdAt = toIso(a.createdAt);
    this.updatedAt = toIso(a.updatedAt);
  }
}

module.exports = AppointmentDTO;
