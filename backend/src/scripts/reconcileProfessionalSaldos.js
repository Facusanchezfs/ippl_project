'use strict';

/**
 * CLI: misma lógica que el panel financiero (`reconcileProfessionalSaldosService`).
 *
 * USO:
 *   node src/scripts/reconcileProfessionalSaldos.js
 *   node src/scripts/reconcileProfessionalSaldos.js --userId=13
 *   node src/scripts/reconcileProfessionalSaldos.js --userId=13 --apply
 *   node src/scripts/reconcileProfessionalSaldos.js --apply
 */

const { sequelize } = require('../../models');
const { runReconcileProfessionalSaldos } = require('../services/reconcileProfessionalSaldosService');

async function main() {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  const userArg = argv.find((a) => a.startsWith('--userId='));
  const onlyUserId = userArg ? userArg.split('=')[1].trim() : null;

  const result = await runReconcileProfessionalSaldos({
    apply,
    userId: onlyUserId,
  });

  if (!result.ok) {
    console.error(result.error);
    await sequelize.close();
    process.exit(1);
  }

  const { period, rows, cantidadDesfase } = result;

  console.log('==============================================================');
  console.log(` reconcileProfessionalSaldos  (${apply ? 'APLICAR' : 'DRY-RUN'})`);
  console.log(
    ` Período: citas y abonos desde ${period.from} hasta ${period.to} (fecha local)`
  );
  console.log('==============================================================');

  for (const row of rows) {
    const {
      professionalId: id,
      name,
      grossFromSessions: g,
      commissionPercent: pct,
      fullCommission,
      abonosSum: ab,
      currentSaldoTotal: oldT,
      currentSaldoPendiente: oldP,
      expectedSaldoTotal: newTotal,
      expectedSaldoPendiente: newPend,
      hayDesfase: diff,
      updated,
    } = row;

    if (!diff && !apply) {
      console.log(
        `[OK id=${id}] ${name}: bruto=${g} comisión_nominal=${fullCommission} abonos=${ab} → coincide con BD`
      );
      continue;
    }

    console.log(
      `[${diff ? 'CAMBIO' : '—'} id=${id}] ${name} | bruto_citas=${g} %=${pct.toFixed(0)} comisión=${fullCommission} abonos=${ab}`
    );
    console.log(
      `   saldoTotal: ${oldT} → ${newTotal} | saldoPendiente: ${oldP} → ${newPend}`
    );

    if (apply && diff && updated) {
      console.log('   ✓ actualizado');
    }
  }

  if (cantidadDesfase === 0) {
    console.log('');
    console.log('Ningún desfase respecto al cálculo desde datos reales.');
  }

  if (!apply) {
    console.log('');
    console.log('Modo dry-run: no se escribió nada. Usa --apply para persistir.');
  }

  await sequelize.close();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await sequelize.close();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
