import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import userService from '../../services/user.service';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface Payment {
  id: string;
  amount: number;
  date: string;
}

const ProfessionalPaymentsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadPayments = async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      const abonos = await userService.getAbonos();
      const myAbonos = (abonos || []).filter(
        (abono) => String(abono.professionalId) === String(user.id)
      );
      setPayments(
        myAbonos.map((a) => ({
          id: a.id,
          amount: Number(a.amount) || 0,
          date: a.date,
        }))
      );
    } catch (error) {
      console.error('Error al cargar historial de pagos:', error);
      toast.error('No se pudo cargar el historial de pagos');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadPayments();
    setIsRefreshing(false);
    toast.success('Historial actualizado');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <div className="p-6 space-y-8">
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/professional')}
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              Volver al Dashboard
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Historial de pagos al instituto
              </h1>
              <p className="mt-1 text-gray-600">
                Aquí verás todos los abonos de comisión registrados a tu nombre.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleRefresh}
              className={`flex items-center px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors ${
                isRefreshing ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              disabled={isRefreshing}
            >
              <ArrowPathIcon
                className={`h-5 w-5 mr-2 ${isRefreshing ? 'animate-spin' : ''}`}
              />
              Actualizar
            </button>
          </div>
        </div>

        {/* Resumen rápido */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 flex items-center">
            <div className="bg-green-500/10 p-3 rounded-lg">
              <CurrencyDollarIcon className="h-7 w-7 text-green-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Total abonado
              </h3>
              <p className="text-2xl font-bold text-green-700">
                ${totalPaid.toFixed(2)}
              </p>
            </div>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 flex items-center">
            <div className="bg-blue-500/10 p-3 rounded-lg">
              <span className="text-blue-600 font-bold text-xl">#</span>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Cantidad de pagos
              </h3>
              <p className="text-2xl font-bold text-blue-700">
                {payments.length}
              </p>
            </div>
          </div>
        </div>

        {/* Tabla de pagos */}
        {payments.length === 0 ? (
          <div className="text-center py-12">
            <CurrencyDollarIcon className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              Aún no registras pagos
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Cuando se registre tu primer abono de comisión, aparecerá aquí.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Monto abonado
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(payment.date).toLocaleString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-700">
                      ${payment.amount.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfessionalPaymentsPage;

