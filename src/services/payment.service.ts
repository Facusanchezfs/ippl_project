import api from '../config/api';

export interface ReceiptEmailPayload {
  payerName: string;
  payerEmail?: string;
  amountPaid?: number;
  currentDebt?: number;
  creditBalance?: number;
  notes?: string;
  files: File[];
}

export async function sendPaymentReceipts({
  payerName,
  payerEmail,
  amountPaid,
  currentDebt,
  creditBalance,
  notes,
  files,
}: ReceiptEmailPayload): Promise<void> {
  const formData = new FormData();

  formData.append('payerName', payerName);

  if (payerEmail) formData.append('payerEmail', payerEmail);
  if (amountPaid !== undefined) formData.append('amountPaid', String(amountPaid));
  if (currentDebt !== undefined) formData.append('currentDebt', String(currentDebt));
  if (creditBalance !== undefined) formData.append('creditBalance', String(creditBalance));
  if (notes) formData.append('notes', notes);

  files.forEach((file) => {
    formData.append('receipts', file);
  });

  await api.post('/payments/send-receipts', formData);
}

