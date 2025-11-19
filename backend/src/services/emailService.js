const nodemailer = require('nodemailer');

const DEFAULT_SMTP_HOST = 'smtp.gmail.com';
const DEFAULT_SMTP_PORT = 465;
const DEFAULT_FINANCE_EMAIL = 'ippl.comprobantes@gmail.com';

function boolFromEnv(value, fallback) {
  if (value === undefined) return fallback;
  return value === 'true' || value === '1';
}

function buildTransport() {
  const user = process.env.EMAIL_SENDER || process.env.SMTP_USER;
  const pass = process.env.APP_KEY || process.env.SMTP_PASS;

  if (!user || !pass) {
    throw new Error('EMAIL_SENDER/SMTP_USER y APP_KEY/SMTP_PASS deben estar configurados para enviar correos.');
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || DEFAULT_SMTP_HOST,
    port: Number(process.env.SMTP_PORT || DEFAULT_SMTP_PORT),
    secure: boolFromEnv(process.env.SMTP_SECURE, true),
    auth: {
      user,
      pass,
    },
  });
}

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = buildTransport();
  }
  return transporter;
}

function formatCurrency(value, currency = 'ARS') {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'N/D';

  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

async function sendPaymentReceiptsEmail({
  recipientEmail,
  payerName,
  payerEmail,
  amountPaid,
  currentDebt,
  creditBalance,
  sentBy,
  notes,
  attachments = [],
}) {
  const to = recipientEmail || DEFAULT_FINANCE_EMAIL;

  const from = process.env.EMAIL_SENDER || process.env.SMTP_USER;
  const subject = `Nuevo comprobante de pago - ${payerName ?? 'Profesional'}`;

  const html = `
    <p>Hola equipo financiero,</p>
    <p>Se registró un nuevo comprobante de transferencia para el profesional <strong>${payerName ?? 'N/D'}</strong>.</p>
    <ul>
      <li><strong>Monto abonado:</strong> ${formatCurrency(amountPaid)}</li>
      <li><strong>Deuda actual:</strong> ${formatCurrency(currentDebt)}</li>
      <li><strong>Saldo a favor:</strong> ${formatCurrency(creditBalance)}</li>
      ${payerEmail ? `<li><strong>Correo del profesional:</strong> ${payerEmail}</li>` : ''}
      ${sentBy ? `<li><strong>Registrado por:</strong> ${sentBy}</li>` : ''}
    </ul>
    ${notes ? `<p><strong>Notas:</strong> ${notes}</p>` : ''}
    <p>Se adjuntan los comprobantes correspondientes.</p>
    <p>Saludos,<br/>Sistema IPPL</p>
  `;

  const mailOptions = {
    from,
    to,
    subject,
    html,
    attachments: attachments.map((file) => ({
      filename: file.originalname,
      content: file.buffer,
      contentType: file.mimetype,
    })),
  };

  const mailer = getTransporter();
  return mailer.sendMail(mailOptions);
}

module.exports = {
  sendPaymentReceiptsEmail,
};

