import React, { useMemo, useState, useEffect } from 'react';
import { Search, UserPlus, ArrowPathIcon } from 'lucide-react';
import Button from '../common/Button';
import Card from '../common/Card';
import userService, { User } from '../../services/user.service';
import patientsService from '../../services/patients.service';
import { Patient } from '../../types/Patient';
import { getFriendlyErrorMessage } from '../../utils/errorMessages';

interface ProfessionalRow {
  id: string;
  name: string;
  email: string;
  status: User['status'];
  commission?: number;
  saldoTotal: number;
  saldoPendiente: number;
  patientsTotal: number;
  patientsActive: number;
  createdAt: string;
}

const PsychologistManagement: React.FC = () => {
  const [professionals, setProfessionals] = useState<User[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | User['status']>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [usersResponse, patientsResponse] = await Promise.all([
        userService.getProfessionals(),
        patientsService.getAllPatients()
      ]);
      setProfessionals(usersResponse);
      setPatients(patientsResponse);
      setError(null);
    } catch (err) {
      console.error('Error cargando profesionales o pacientes:', err);
      setError(getFriendlyErrorMessage(err, 'No se pudo cargar la información de profesionales.'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
  };

  const rows: ProfessionalRow[] = useMemo(() => {
    const patientStats = patients.reduce<Record<string, { total: number; active: number }>>((acc, patient) => {
      const professionalId = patient.professionalId;
      if (!professionalId) return acc;
      const key = String(professionalId);
      if (!acc[key]) {
        acc[key] = { total: 0, active: 0 };
      }
      acc[key].total += 1;
      if (patient.status === 'active') {
        acc[key].active += 1;
      }
      return acc;
    }, {});

    return professionals.map((professional) => {
      const stats = patientStats[professional.id] ?? { total: 0, active: 0 };
      return {
        id: professional.id,
        name: professional.name,
        email: professional.email,
        status: professional.status,
        commission: professional.commission,
        saldoTotal: professional.saldoTotal ?? 0,
        saldoPendiente: professional.saldoPendiente ?? 0,
        patientsTotal: stats.total,
        patientsActive: stats.active,
        createdAt: professional.createdAt
      };
    });
  }, [professionals, patients]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchesSearch =
        row.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.email.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || row.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [rows, searchTerm, statusFilter]);

  let tableBody: React.ReactNode;

  if (isLoading) {
    tableBody = (
      <tr>
        <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
          Cargando profesionales...
        </td>
      </tr>
    );
  } else if (filteredRows.length === 0) {
    tableBody = (
      <tr>
        <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
          No se encontraron profesionales que coincidan con los filtros seleccionados.
        </td>
      </tr>
    );
  } else {
    tableBody = filteredRows.map((row) => {
      const isActive = row.status === 'active';
      const badgeClasses = isActive
        ? 'bg-green-100 text-green-800'
        : 'bg-gray-200 text-gray-700';

      return (
        <tr key={row.id}>
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-900">{row.name}</span>
              <span className="text-sm text-gray-500">{row.email}</span>
              <span className="text-xs text-gray-400 mt-1">
                Alta: {new Date(row.createdAt).toLocaleDateString('es-AR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric'
                })}
              </span>
            </div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
            <div className="flex flex-col">
              <span>{row.patientsActive} activos</span>
              <span className="text-xs text-gray-500">{row.patientsTotal} total</span>
            </div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
            {row.commission != null ? `${row.commission.toFixed(2)}%` : 'Sin asignar'}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
            ${row.saldoTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
            ${row.saldoPendiente.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <span
              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${badgeClasses}`}
            >
              {isActive ? 'Activo' : 'Inactivo'}
            </span>
          </td>
        </tr>
      );
    });
  }

  return (
    <div className="py-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Profesionales registrados</h1>
          <p className="text-sm text-gray-500 mt-1">
            Consulta el listado real de profesionales cargados en la plataforma, su estado y la comisión asociada.
          </p>
        </div>

        <div className="flex items-center gap-3 mt-4 md:mt-0">
          <Button
            variant="secondary"
            className="inline-flex items-center"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <ArrowPathIcon className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button variant="primary" className="inline-flex items-center" disabled>
            <UserPlus size={16} className="mr-2" />
            Agregar Profesional
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search size={18} className="text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar por nombre o email..."
                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          <div>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              disabled={isLoading}
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </div>
        </div>
      </Card>

      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
          <p>{error}</p>
          <Button
            variant="secondary"
            className="mt-3"
            onClick={handleRefresh}
          >
            Reintentar
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Profesional
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pacientes
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Comisión
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Saldo total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Saldo pendiente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tableBody}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PsychologistManagement;