'use strict';

const { User } = require('../../models');

function toAmount(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * Fuente única de verdad para `remainingBalance` cuando la sesión se considera
 * **asistida** (`attended === true`), alineado con `updateAppointment`:
 *
 * - sessionCost y paymentAmount nulos se tratan como 0 en el cálculo.
 * - remainingBalance = max(sessionCost - paymentAmount, 0).
 *
 * Cuando `attended === false` (no-show en flujo manual), el controlador pone
 * `remainingBalance = null` y limpia `paymentAmount`; ese camino no aplica
 * al auto-complete del CRON, que siempre marca `attended: true`.
 *
 * @param {{ sessionCost?: unknown; paymentAmount?: unknown }} apptLike
 * @returns {number} ≥ 0 (nulos en coste/pago se tratan como 0, igual que recalcRB en updateAppointment)
 */
function computeRemainingBalanceAttended(apptLike) {
  const sc = toAmount(apptLike.sessionCost) ?? 0;
  const pa = toAmount(apptLike.paymentAmount) ?? 0;
  return Math.max(sc - pa, 0);
}

/**
 * Snapshot mínimo para efectos en balance del profesional (misma semántica que updateAppointment).
 * @param {import('sequelize').Model} appt
 */
function buildBalanceSnapshot(appt) {
  return {
    professionalId: appt.professionalId,
    status: appt.status,
    attended: appt.attended === true,
    sessionCost: toAmount(appt.sessionCost) ?? 0,
  };
}

/**
 * Aplica el mismo delta de `saldoTotal` / `saldoPendiente` que el bloque
 * histórico de `updateAppointment`, en base a la transición before → after.
 *
 * @param {import('sequelize').Transaction} transaction
 * @param {ReturnType<typeof buildBalanceSnapshot>} before
 * @param {ReturnType<typeof buildBalanceSnapshot>} after
 * @returns {Promise<{ deltas: Array<{ professionalId: string|number; delta: number }> }>}
 */
async function applyProfessionalBalanceForTransition(transaction, before, after) {
  const includePrev = before.status === 'completed' && before.attended;
  const includeNext = after.status === 'completed' && after.attended;
  const prevProfId = before.professionalId;
  const nextProfId = after.professionalId;
  const prevCost = before.sessionCost ?? 0;
  const nextCost = after.sessionCost ?? 0;

  const deltas = [];

  const applyDelta = async (userId, delta) => {
    if (!userId || !delta) return;

    const prof = await User.findByPk(userId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!prof) return;

    const currentTotal = toAmount(prof.saldoTotal) ?? 0;
    const currentPend = toAmount(prof.saldoPendiente) ?? 0;
    const newTotal = round2(currentTotal + delta);

    let commissionInt = parseInt(prof.commission ?? 0, 10);
    if (isNaN(commissionInt)) commissionInt = 0;
    commissionInt = Math.max(0, Math.min(100, commissionInt));
    const commissionRate = commissionInt / 100;

    const newSessionPend = round2(delta * commissionRate);
    const newPend = round2(currentPend + newSessionPend);

    await prof.update(
      { saldoTotal: newTotal, saldoPendiente: newPend },
      { transaction }
    );

    deltas.push({ professionalId: userId, delta });
  };

  if (prevProfId !== nextProfId) {
    if (includePrev && prevCost) await applyDelta(prevProfId, -prevCost);
    if (includeNext && nextCost) await applyDelta(nextProfId, +nextCost);
  } else {
    const beforeAmt = includePrev ? prevCost : 0;
    const afterAmt = includeNext ? nextCost : 0;
    const delta = round2(afterAmt - beforeAmt);
    if (delta !== 0) await applyDelta(prevProfId, delta);
  }

  return { deltas };
}

module.exports = {
  toAmount,
  round2,
  computeRemainingBalanceAttended,
  buildBalanceSnapshot,
  applyProfessionalBalanceForTransition,
};
