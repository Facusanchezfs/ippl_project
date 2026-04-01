'use strict';

const { Op } = require('sequelize');
const { User, Appointment, Abono } = require('../../models');

/** Corte inclusive: solo sesiones / abonos desde esta fecha (YYYY-MM-DD). */
const RECONCILE_FROM_YMD = '2026-03-30';

function todayLocalYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function commissionRateFromUser(prof) {
  let c = parseInt(prof.commission ?? 0, 10);
  if (Number.isNaN(c)) c = 0;
  c = Math.max(0, Math.min(100, c));
  return c / 100;
}

/**
 * Misma regla que el script CLI: recalcula saldos desde citas completadas/asistidas
 * y abonos en el período; opcionalmente persiste en Users.
 *
 * @param {object} options
 * @param {boolean} [options.apply=false]
 * @param {string|number|null} [options.userId=null]
 * @param {import('sequelize').Transaction|null} [options.transaction=null]
 * @returns {Promise<{ ok: boolean, error?: string, period: { from: string, to: string }, rows: object[], cantidadDesfase: number, cantidadActualizados?: number }>}
 */
async function runReconcileProfessionalSaldos(options = {}) {
  const apply = Boolean(options.apply);
  const userId =
    options.userId != null && options.userId !== ''
      ? String(options.userId).trim()
      : null;
  const transaction = options.transaction ?? null;

  const toYmd = todayLocalYmd();
  if (toYmd < RECONCILE_FROM_YMD) {
    return {
      ok: false,
      error: `Fecha local hoy (${toYmd}) es anterior al corte ${RECONCILE_FROM_YMD}; revisar reloj o constante.`,
      period: { from: RECONCILE_FROM_YMD, to: toYmd },
      rows: [],
      cantidadDesfase: 0,
    };
  }

  const whereUser = { role: 'professional' };
  if (userId) whereUser.id = userId;

  const professionals = await User.findAll({
    where: whereUser,
    attributes: ['id', 'name', 'email', 'commission', 'saldoTotal', 'saldoPendiente'],
    order: [['id', 'ASC']],
    transaction,
  });

  const dateRange = { [Op.between]: [RECONCILE_FROM_YMD, toYmd] };

  const rows = [];
  let cantidadDesfase = 0;
  let cantidadActualizados = 0;

  for (const prof of professionals) {
    const gross = await Appointment.sum('sessionCost', {
      where: {
        professionalId: prof.id,
        status: 'completed',
        attended: true,
        active: true,
        date: dateRange,
      },
      transaction,
    });

    const g = round2(Number(gross) || 0);
    const rate = commissionRateFromUser(prof);
    const fullCommission = round2(g * rate);

    const abonosSum =
      (await Abono.sum('amount', {
        where: {
          professionalId: prof.id,
          date: dateRange,
        },
        transaction,
      })) || 0;
    const ab = round2(Number(abonosSum) || 0);

    const newPend = round2(Math.max(0, fullCommission - ab));
    const newTotal = newPend <= 0 ? 0 : g;

    const oldT = round2(Number(prof.saldoTotal) || 0);
    const oldP = round2(Number(prof.saldoPendiente) || 0);

    const hayDesfase =
      Math.abs(oldT - newTotal) > 0.009 || Math.abs(oldP - newPend) > 0.009;

    if (hayDesfase) cantidadDesfase += 1;

    let updated = false;
    if (apply && hayDesfase) {
      await prof.update(
        {
          saldoTotal: newTotal,
          saldoPendiente: newPend,
        },
        { transaction }
      );
      updated = true;
      cantidadActualizados += 1;
    }

    rows.push({
      professionalId: prof.id,
      name: prof.name,
      email: prof.email,
      commissionPercent: round2(rate * 100),
      grossFromSessions: g,
      fullCommission,
      abonosSum: ab,
      currentSaldoTotal: oldT,
      currentSaldoPendiente: oldP,
      expectedSaldoTotal: newTotal,
      expectedSaldoPendiente: newPend,
      hayDesfase,
      updated,
    });
  }

  const base = {
    ok: true,
    period: { from: RECONCILE_FROM_YMD, to: toYmd },
    rows,
    cantidadDesfase,
  };
  if (apply) base.cantidadActualizados = cantidadActualizados;
  return base;
}

module.exports = {
  RECONCILE_FROM_YMD,
  runReconcileProfessionalSaldos,
  todayLocalYmd,
  round2,
  commissionRateFromUser,
};
