import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import userService, { UpdateUserData, User } from '../services/user.service';
import Button from '../components/common/Button';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const FinancialPagosPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [comissionById, setComissionById] = useState<Record<string | number, number>>({});
  const [abonos, setAbonos] = useState<{ [key: string]: string }>({});
  const [saving, setSaving] = useState<{ [key: string]: boolean }>({});
  const [totalDeudaComision, setTotalDeudaComision] = useState(0);

  useEffect(() => {
    fetchProfessionals();
  }, []);

  const fetchProfessionals = async () => {
  setLoading(true);
  try {
    const users = await userService.getProfessionals();
    setProfessionals(users);

    const totalDeuda = users.reduce((acc: number, p: any) => {
      const pend = p?.saldoPendiente;
      return acc + pend;
    }, 0);

    setTotalDeudaComision(totalDeuda);
  } catch (err) {
    console.error('Error cargando profesionales:', err);
    toast.error('Error al cargar profesionales');
  } finally {
    setLoading(false);
  }
};

  const handleAbonoChange = (id: string, value: string) => {
    setAbonos({ ...abonos, [id]: value });
  };

  const getCommision = (p: { id: string | number; commission?: number }) =>
  comissionById[p.id] ?? (p.commission ?? 0);

  const handleCommision = async (userId: string, comission: number) =>{
    const updateData: UpdateUserData = {};
    try{
      updateData.commission = comission
      const userUpdated = await userService.updateUser(userId, updateData);
      if (userUpdated.commission == comissionById[userUpdated.id]){
        toast.success("Comision actualizada correctamente")
      }
    } catch (e) {
      console.error('Error asignando comision:', e);
      toast.error('Error asignando comision');
    }
  }

  const handleAbonar = async (id: string) => {
    setSaving({ ...saving, [id]: true });
    const abono = parseFloat(abonos[id] || '0');
    if (abono > 0) {
      await userService.abonarComision(id, abono);
      // Actualizar el saldo total del profesional localmente
      await fetchProfessionals();
      setAbonos({ ...abonos, [id]: '' });
    }
    setSaving({ ...saving, [id]: false });
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
              <th className="px-4 py-2">Saldo Total</th>
              <th className="px-4 py-2">Comisión (%)</th>
              <th className="px-4 py-2">Deuda Actual</th>
              <th className="px-4 py-2">Abonar</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-4">Cargando...</td></tr>
            ) : professionals.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-4">No hay profesionales registrados</td></tr>
            ) : professionals.map((prof: User) => {
              return (
                <tr key={prof.id} className="border-b hover:bg-blue-50 transition-colors">
                  <td className="text-center px-4 py-2 font-medium text-gray-800 whitespace-nowrap">{prof.name}</td>
                  <td className="text-center px-4 py-2 whitespace-nowrap">${prof.saldoTotal.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
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
                      >
                        Actualizar
                      </Button>
                    </div>
                  </td>

                  <td className="text-center px-4 py-2 text-red-600 font-semibold whitespace-nowrap">${prof.saldoPendiente.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2 items-center justify-end">
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
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FinancialPagosPage; 