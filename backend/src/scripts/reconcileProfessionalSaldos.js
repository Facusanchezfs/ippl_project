'use strict';

/**
 * Recalcula `saldoTotal` y `saldoPendiente` en Users a partir de citas completadas
 * y abonos registrados, alineado con la semántica de `abonarComision`:
 * - saldoTotal = suma de `sessionCost` de citas activas, completadas y asistidas
 *   mientras aún haya comisión pendiente de pagar; si la deuda de comisión llega a 0, saldoTotal = 0.
 * - saldoPendiente = max(0, comisión teórica sobre ese bruto − suma de Abonos del profesional).
 *
 * USO (siempre revisar dry-run primero):
 *   node src/scripts/reconcileProfessionalSaldos.js
 *   node src/scripts/reconcileProfessionalSaldos.js --userId=13
 *   node src/scripts/reconcileProfessionalSaldos.js --userId=13 --apply
 *
 * Período contable: solo citas y abonos con fecha civil entre 2026-03-30 y hoy
 * (hora local del servidor). Todo lo anterior al 30/03/2026 no entra al cálculo.
 *
 * IMPORTANTE: ejecutar con backup en producción. Si hay lógica contable fuera de
 * este modelo (ajustes manuales, otra fuente de abonos), revisar antes de aplicar.
 */

const { Op } = require('sequelize');
const { User, Appointment, Abono, sequelize } = require('../../models');

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

async function main() {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  const userArg = argv.find((a) => a.startsWith('--userId='));
  const onlyUserId = userArg ? userArg.split('=')[1].trim() : null;

  const whereUser = { role: 'professional' };
  if (onlyUserId) whereUser.id = onlyUserId;

  const professionals = await User.findAll({
    where: whereUser,
    attributes: ['id', 'name', 'email', 'commission', 'saldoTotal', 'saldoPendiente'],
    order: [['id', 'ASC']],
  });

  const toYmd = todayLocalYmd();
  if (toYmd < RECONCILE_FROM_YMD) {
    throw new Error(
      `Fecha local hoy (${toYmd}) es anterior al corte ${RECONCILE_FROM_YMD}; revisar reloj o constante.`
    );
  }
  const dateRange = { [Op.between]: [RECONCILE_FROM_YMD, toYmd] };

  console.log('==============================================================');
  console.log(` reconcileProfessionalSaldos  (${apply ? 'APLICAR' : 'DRY-RUN'})`);
  console.log(
    ` Período: citas y abonos desde ${RECONCILE_FROM_YMD} hasta ${toYmd} (fecha local)`
  );
  console.log('==============================================================');

  for (const prof of professionals) {
    const gross = await Appointment.sum('sessionCost', {
      where: {
        professionalId: prof.id,
        status: 'completed',
        attended: true,
        active: true,
        date: dateRange,
      },
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
      })) || 0;
    const ab = round2(Number(abonosSum) || 0);

    const newPend = round2(Math.max(0, fullCommission - ab));
    const newTotal = newPend <= 0 ? 0 : g;

    const oldT = round2(Number(prof.saldoTotal) || 0);
    const oldP = round2(Number(prof.saldoPendiente) || 0);

    const diff =
      Math.abs(oldT - newTotal) > 0.009 || Math.abs(oldP - newPend) > 0.009;

    if (!diff && !apply) {
      console.log(
        `[OK id=${prof.id}] ${prof.name}: bruto=${g} comisión_nominal=${fullCommission} abonos=${ab} → coincide con BD`
      );
      continue;
    }

    console.log(
      `[${diff ? 'CAMBIO' : '—'} id=${prof.id}] ${prof.name} | bruto_citas=${g} %=${(rate * 100).toFixed(0)} comisión=${fullCommission} abonos=${ab}`
    );
    console.log(
      `   saldoTotal: ${oldT} → ${newTotal} | saldoPendiente: ${oldP} → ${newPend}`
    );

    if (apply && diff) {
      await prof.update({
        saldoTotal: newTotal,
        saldoPendiente: newPend,
      });
      console.log('   ✓ actualizado');
    }
  }

  if (!apply) {
    console.log('');
    console.log('Modo dry-run: no se escribió nada. Usa --apply para persistir.');
  }

  await sequelize.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
