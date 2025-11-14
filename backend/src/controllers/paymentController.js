'use strict';
const { sendPaymentReceiptsEmail } = require('../services/emailService');
const logger = require('../utils/logger');

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
      return res.status(400).json({ message: 'Debe adjuntar al menos un comprobante.' });
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

    return res.json({ message: 'Comprobantes enviados correctamente.' });
  } catch (error) {
    logger.error('Error enviando comprobantes:', error);
    return res.status(500).json({ message: 'No se pudieron enviar los comprobantes.' });
  }
}

module.exports = {
  sendReceipts,
};

