'use strict';

const { sequelize } = require('../../models');
const { sendSuccess, sendError } = require('../utils/response');
const { runReconcileProfessionalSaldos } = require('../services/reconcileProfessionalSaldosService');
const logger = require('../utils/logger');

const previewReconcileSaldos = async (req, res) => {
  try {
    const result = await runReconcileProfessionalSaldos({ apply: false });
    if (!result.ok) {
      return sendError(res, 400, result.error);
    }
    return sendSuccess(res, {
      period: result.period,
      rows: result.rows,
      cantidadDesfase: result.cantidadDesfase,
    });
  } catch (e) {
    logger.error('[previewReconcileSaldos]', e);
    return sendError(res, 500, 'Error al calcular desfasajes');
  }
};

const applyReconcileSaldos = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const result = await runReconcileProfessionalSaldos({
      apply: true,
      transaction: t,
    });
    if (!result.ok) {
      await t.rollback();
      return sendError(res, 400, result.error);
    }
    await t.commit();
    logger.info(
      `[applyReconcileSaldos] Actualizados ${result.cantidadActualizados ?? 0} profesional(es); desfases detectados: ${result.cantidadDesfase}`
    );
    return sendSuccess(
      res,
      {
        period: result.period,
        rows: result.rows,
        cantidadDesfase: result.cantidadDesfase,
        cantidadActualizados: result.cantidadActualizados,
      },
      'Saldos corregidos según datos reales.'
    );
  } catch (e) {
    await t.rollback();
    logger.error('[applyReconcileSaldos]', e);
    return sendError(res, 500, 'Error al aplicar corrección');
  }
};

module.exports = {
  previewReconcileSaldos,
  applyReconcileSaldos,
};
