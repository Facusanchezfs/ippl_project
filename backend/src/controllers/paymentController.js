'use strict';
const { sendPaymentReceiptsEmail } = require('../services/emailService');
const logger = require('../utils/logger');
const { sendSuccess, sendError } = require('../utils/response');

function toNumber(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

async function sendReceipts(req, res) {
  try {
    const { payerName, payerEmail, amountPaid, currentDebt, creditBalance, notes } = req.body;

    const sentBy = req.user?.name ?? req.user?.email ?? 'Usuario IPPL';
    const attachments = Array.isArray(req.files) ? req.files : [];

    if (!attachments.length) {
      return sendError(res, 400, 'Debe adjuntar al menos un comprobante.');
    }

    await sendPaymentReceiptsEmail({
      payerName,
      payerEmail,
      amountPaid: toNumber(amountPaid),
      currentDebt: toNumber(currentDebt),
      creditBalance: toNumber(creditBalance),
      sentBy,
      notes,
      attachments,
    });

    return sendSuccess(res, null, 'Comprobantes enviados correctamente.');
  } catch (error) {
    logger.error('Error enviando comprobantes:', error);
    return sendError(res, 500, 'No se pudieron enviar los comprobantes.');
  }
}

module.exports = {
  sendReceipts,
};

