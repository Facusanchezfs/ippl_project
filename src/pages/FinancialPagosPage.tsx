import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import userService, { UpdateUserData, User } from '../services/user.service';
import { sendPaymentReceipts } from '../services/payment.service';
import Button from '../components/common/Button';
import ConfirmationModal from '../components/common/ConfirmationModal';
import { ArrowLeftIcon, PaperClipIcon, XMarkIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

type ReceiptForm = {
  amountPaid: string;
  currentDebt: string;
  creditBalance: string;
  notes: string;
};

const CURRENCY_FORMATTER = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatCurrencyValue = (value: string): string => {
  if (!value) return CURRENCY_FORMATTER.format(0);
  const number = Number(value);
  if (!Number.isFinite(number)) return CURRENCY_FORMATTER.format(0);
  return CURRENCY_FORMATTER.format(number);
};

const getCurrencyPreview = (value: string): string => {
  if (!value) return 'Sin valor';
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Valor inválido';
  return CURRENCY_FORMATTER.format(number);
};

const calculateCreditBalance = (amountPaid: string, currentDebt: string): string => {
  const amount = Number(amountPaid || '0');
  const debt = Number(currentDebt || '0');
  if (!Number.isFinite(amount) || !Number.isFinite(debt)) return '0.00';
  const diff = amount - debt;
  return diff > 0 ? diff.toFixed(2) : '0.00';
};

const createDefaultReceiptForm = (): ReceiptForm => ({
  amountPaid: '',
  currentDebt: '',
  creditBalance: '0.00',
  notes: '',
});

const FinancialPagosPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [professionals, setProfessionals] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [comissionById, setComissionById] = useState<Record<string | number, number>>({});
  const [abonos, setAbonos] = useState<{ [key: string]: string }>({});
  const [saving, setSaving] = useState<{ [key: string]: boolean }>({});
  const [commissionSaving, setCommissionSaving] = useState<{ [key: string]: boolean }>({});
  const [totalDeudaComision, setTotalDeudaComision] = useState(0);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAbono, setPendingAbono] = useState<{ professionalId: string; professionalName: string; amount: number } | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedProfessional, setSelectedProfessional] = useState<User | null>(null);
  const [receiptForm, setReceiptForm] = useState<ReceiptForm>(() => createDefaultReceiptForm());
  const [receiptFiles, setReceiptFiles] = useState<File[]>([]);
  const [sendingReceipts, setSendingReceipts] = useState(false);
  const receiptModalIdPrefix = selectedProfessional ? `receipt-${selectedProfessional.id}` : 'receipt';

  useEffect(() => {
    fetchProfessionals();
  }, []);

  const fetchProfessionals = async (options?: { showLoading?: boolean }) => {
  const showLoading = options?.showLoading ?? true;
  if (showLoading) setLoading(true);
  try {
    const users = await userService.getProfessionals();
    setProfessionals(users);

    const totalDeuda = users.reduce((accumulator: number, professional: User) => {
      const pend = professional?.saldoPendiente ?? 0;
      return accumulator + pend;
    }, 0);

    setTotalDeudaComision(totalDeuda);
  } catch (err) {
    console.error('Error cargando profesionales:', err);
    toast.error('Error al cargar profesionales');
  } finally {
    if (showLoading) setLoading(false);
  }
};

  const handleAbonoChange = (id: string, value: string) => {
    setAbonos({ ...abonos, [id]: value });
  };

  const getCommision = (p: { id: string | number; commission?: number }) =>
  comissionById[p.id] ?? (p.commission ?? 0);

  const handleCommision = async (userId: string, comission: number) =>{
    const updateData: UpdateUserData = {};
    setCommissionSaving(prev => ({ ...prev, [userId]: true }));
    const scrollPosition = window.scrollY;
    try{
      updateData.commission = comission
      const userUpdated = await userService.updateUser(userId, updateData);
      await fetchProfessionals({ showLoading: false });
      setComissionById(prev => ({
        ...prev,
        [userUpdated.id]: userUpdated.commission ?? 0,
      }));
      window.scrollTo({ top: scrollPosition, behavior: 'auto' });
      toast.success("Comision actualizada correctamente")
    } catch (e) {
      console.error('Error asignando comision:', e);
      toast.error('Error asignando comision');
    } finally {
      setCommissionSaving(prev => ({ ...prev, [userId]: false }));
    }
  }

  const handleAbonar = (id: string) => {
    const abono = parseFloat(abonos[id] || '0');
    if (abono > 0) {
      const professional = professionals.find((p: User) => p.id === id);
      if (professional) {
        setPendingAbono({
          professionalId: id,
          professionalName: professional.name,
          amount: abono
        });
        setShowConfirmModal(true);
      }
    }
  };

  const handleConfirmAbonar = async () => {
    if (!pendingAbono) return;
    
    setShowConfirmModal(false);
    setSaving({ ...saving, [pendingAbono.professionalId]: true });
    
    try {
      await userService.abonarComision(pendingAbono.professionalId, pendingAbono.amount);
      // Actualizar el saldo total del profesional localmente
      await fetchProfessionals();
      setAbonos({ ...abonos, [pendingAbono.professionalId]: '' });
      toast.success(`Se abonó $${pendingAbono.amount.toLocaleString('es-CO', { minimumFractionDigits: 2 })} a ${pendingAbono.professionalName}`);
    } catch (error) {
      console.error('Error al abonar:', error);
      toast.error('Error al realizar el abono');
    } finally {
      setSaving({ ...saving, [pendingAbono.professionalId]: false });
      setPendingAbono(null);
    }
  };

  const handleOpenReceiptModal = (prof: User) => {
    setSelectedProfessional(prof);

    const abonoValue = abonos[prof.id];
    const normalizedAmount =
      abonoValue && !Number.isNaN(Number(abonoValue))
        ? Number(abonoValue).toFixed(2)
        : '';

    const normalizedDebt = Number(prof.saldoPendiente ?? 0).toFixed(2);

    setReceiptForm({
      amountPaid: normalizedAmount,
      currentDebt: normalizedDebt,
      creditBalance: calculateCreditBalance(normalizedAmount, normalizedDebt),
      notes: '',
    });
    setReceiptFiles([]);
    setIsReceiptModalOpen(true);
  };

  const handleCloseReceiptModal = () => {
    setIsReceiptModalOpen(false);
    setSelectedProfessional(null);
    setReceiptForm(createDefaultReceiptForm());
    setReceiptFiles([]);
  };

  const handleCurrencyChange = (field: 'amountPaid' | 'currentDebt', rawValue: string) => {
    setReceiptForm((prev) => {
      const next = {
        ...prev,
        [field]: rawValue,
      };

      const amount = field === 'amountPaid' ? rawValue : prev.amountPaid;
      const debt = field === 'currentDebt' ? rawValue : prev.currentDebt;
      next.creditBalance = calculateCreditBalance(amount, debt);

      return next;
    });
  };

  const handleReceiptFieldChange = (field: 'notes', value: string) => {
    setReceiptForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleReceiptFilesChange = (files: FileList | null) => {
    if (!files) return;
    setReceiptFiles(Array.from(files));
  };

  const handleRemoveReceiptFile = (index: number) => {
    setReceiptFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSendReceipts = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedProfessional) return;

    if (!receiptFiles.length) {
      toast.error('Adjunta al menos un comprobante antes de enviar.');
      return;
    }

    setSendingReceipts(true);
    try {
      await sendPaymentReceipts({
        payerName: selectedProfessional.name,
        payerEmail: selectedProfessional.email,
        amountPaid: receiptForm.amountPaid ? Number(receiptForm.amountPaid) : undefined,
        currentDebt: receiptForm.currentDebt ? Number(receiptForm.currentDebt) : undefined,
        creditBalance: receiptForm.creditBalance ? Number(receiptForm.creditBalance) : undefined,
        notes: receiptForm.notes || undefined,
        files: receiptFiles,
      });

      toast.success('Comprobantes enviados correctamente');
      handleCloseReceiptModal();
    } catch (error) {
      console.error('Error enviando comprobantes:', error);
      toast.error('No se pudieron enviar los comprobantes');
    } finally {
      setSendingReceipts(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-6">
        {user?.role === 'admin' && (
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Volver al Dashboard
          </button>
        )}
        <h1 className="text-2xl font-bold">Gestión de Pagos de Profesionales</h1>
      </div>
      <div className="mb-4 text-lg font-semibold text-red-700">
        Pagos pendientes totales con el instituto: ${totalDeudaComision.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border rounded shadow">
          <thead>
            <tr className="bg-blue-600 text-white">
              <th className="px-4 py-2">Profesional</th>
              <th className="px-4 py-2">Comisión (%)</th>
              <th className="px-4 py-2">Deuda Actual</th>
              <th className="px-4 py-2">Abonar</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="text-center py-4">Cargando...</td></tr>
            ) : professionals.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-4">No hay profesionales registrados</td></tr>
            ) : professionals.map((prof: User) => {
              return (
                <tr key={prof.id} className="border-b hover:bg-blue-50 transition-colors">
                  <td className="text-center px-4 py-2 font-medium text-gray-800 whitespace-nowrap">{prof.name}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <div className="flex items-center gap-2 justify-center">
                      <div className="flex items-center">
                        <input
                          type="number"
                          className="w-20 border rounded px-2 py-1 text-right"
                          value={getCommision(prof)}
                          onChange={(e) => {
                            const v = e.target.value;
                            setComissionById(prev => ({
                              ...prev,
                              [prof.id]: v === '' ? 0 : Number(v),
                            }));
                          }}
                          min={0}
                          step={0.01}
                          inputMode="decimal"
                        />
                        <span className="ml-1">%</span>
                      </div>
                       <Button
                        onClick={() => handleCommision(prof.id, getCommision(prof))}
                        className="px-2 py-1 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700"
                        disabled={commissionSaving[prof.id]}
                      >
                        {commissionSaving[prof.id] ? 'Actualizando...' : 'Actualizar'}
                      </Button>
                    </div>
                  </td>

                  <td className="text-center px-4 py-2 text-red-600 font-semibold whitespace-nowrap">${prof.saldoPendiente.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex gap-2 items-center">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={abonos[prof.id] || ''}
                        onChange={e => handleAbonoChange(prof.id, e.target.value)}
                        className="border rounded px-2 py-1 w-24"
                        disabled={saving[prof.id]}
                      />
                      <Button
                        onClick={() => handleAbonar(prof.id)}
                        disabled={saving[prof.id] || !abonos[prof.id] || parseFloat(abonos[prof.id]) <= 0}
                      >
                        {saving[prof.id] ? 'Abonando...' : 'Abonar'}
                      </Button>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                        onClick={() => handleOpenReceiptModal(prof)}
                        disabled={sendingReceipts && selectedProfessional?.id === prof.id}
                      >
                        <PaperClipIcon className="h-4 w-4" />
                        Enviar comprobantes
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isReceiptModalOpen && selectedProfessional && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <button
            type="button"
            className="absolute inset-0 bg-black bg-opacity-40"
            onClick={handleCloseReceiptModal}
            aria-label="Cerrar modal"
          />
          <div className="relative z-10 w-full max-w-2xl mx-4 bg-white rounded-lg shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">
                Enviar comprobantes a {selectedProfessional.name}
              </h2>
              <button
                type="button"
                onClick={handleCloseReceiptModal}
                className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
                aria-label="Cerrar modal"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSendReceipts} className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor={`${receiptModalIdPrefix}-amount`}
                    className="block text-sm font-medium text-gray-700"
                  >
                    Monto abonado
                  </label>
                  <div className="mt-1 relative">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                      $
                    </span>
                    <input
                      id={`${receiptModalIdPrefix}-amount`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={receiptForm.amountPaid}
                      onChange={(event) => handleCurrencyChange('amountPaid', event.target.value)}
                      className="w-full rounded-md border border-gray-300 pl-8 pr-3 py-2 focus:border-[#00B19F] focus:outline-none focus:ring-1 focus:ring-[#00B19F]"
                      placeholder="0.00"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Vista previa: {getCurrencyPreview(receiptForm.amountPaid)}
                  </p>
                </div>
                <div>
                  <label
                    htmlFor={`${receiptModalIdPrefix}-debt`}
                    className="block text-sm font-medium text-gray-700"
                  >
                    Deuda actual
                  </label>
                  <div className="mt-1 relative">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                      $
                    </span>
                    <input
                      id={`${receiptModalIdPrefix}-debt`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={receiptForm.currentDebt}
                      onChange={(event) => handleCurrencyChange('currentDebt', event.target.value)}
                      className="w-full rounded-md border border-gray-300 pl-8 pr-3 py-2 focus:border-[#00B19F] focus:outline-none focus:ring-1 focus:ring-[#00B19F]"
                      placeholder="0.00"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Vista previa: {getCurrencyPreview(receiptForm.currentDebt)}
                  </p>
                </div>
                <div>
                  <label
                    htmlFor={`${receiptModalIdPrefix}-credit`}
                    className="block text-sm font-medium text-gray-700"
                  >
                    Saldo a favor
                  </label>
                  <input
                    id={`${receiptModalIdPrefix}-credit`}
                    type="text"
                    value={formatCurrencyValue(receiptForm.creditBalance)}
                    readOnly
                    className="mt-1 w-full rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-gray-700 cursor-not-allowed"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Se calcula automáticamente como la diferencia entre monto abonado y deuda actual.
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <label
                    htmlFor={`${receiptModalIdPrefix}-notes`}
                    className="block text-sm font-medium text-gray-700"
                  >
                    Notas internas (opcional)
                  </label>
                  <textarea
                    id={`${receiptModalIdPrefix}-notes`}
                    value={receiptForm.notes}
                    onChange={(event) => handleReceiptFieldChange('notes', event.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#00B19F] focus:outline-none focus:ring-1 focus:ring-[#00B19F]"
                    placeholder="Agregar detalles relevantes para contabilidad..."
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor={`${receiptModalIdPrefix}-files`}
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Comprobantes de transferencia
                </label>
                <label
                  htmlFor={`${receiptModalIdPrefix}-files`}
                  className="flex cursor-pointer items-center gap-2 rounded-md border-2 border-dashed border-gray-300 px-4 py-3 text-sm text-gray-600 hover:border-[#00B19F] hover:text-[#00B19F]"
                >
                  <PaperClipIcon className="h-5 w-5" />
                  <span>Seleccionar archivos (PDF o imagen)</span>
                  <input
                    id={`${receiptModalIdPrefix}-files`}
                    type="file"
                    multiple
                    accept=".pdf,image/*"
                    className="hidden"
                    onChange={(event) => handleReceiptFilesChange(event.target.files)}
                  />
                </label>
                {receiptFiles.length > 0 && (
                  <ul className="mt-3 space-y-2 text-sm text-gray-700">
                    {receiptFiles.map((file, index) => (
                      <li key={`${file.name}-${index}`} className="flex items-center justify-between rounded bg-gray-50 px-3 py-2">
                        <span className="truncate pr-3">{file.name}</span>
                        <button
                          type="button"
                          className="text-red-500 hover:text-red-600 text-xs font-medium"
                          onClick={() => handleRemoveReceiptFile(index)}
                        >
                          Quitar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-xs text-gray-500">
                  Se permiten hasta 10 archivos, máximo 10&nbsp;MB cada uno.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 border-t pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseReceiptModal}
                  disabled={sendingReceipts}
                >
                  Cancelar
                </Button>
                <Button type="submit" isLoading={sendingReceipts} disabled={sendingReceipts}>
                  Enviar comprobantes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de confirmación de abono */}
      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false);
          setPendingAbono(null);
        }}
        onConfirm={handleConfirmAbonar}
        title="Confirmar Abono"
        message={
          pendingAbono
            ? `¿Está seguro de que desea abonar $${pendingAbono.amount.toLocaleString('es-CO', { minimumFractionDigits: 2 })} a ${pendingAbono.professionalName}?`
            : ''
        }
        confirmText="Confirmar Abono"
        cancelText="Cancelar"
        type="info"
      />
    </div>
  );
};

export default FinancialPagosPage; 