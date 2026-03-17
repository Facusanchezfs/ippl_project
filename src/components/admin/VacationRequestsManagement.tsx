import React, { useEffect, useState } from 'react';
import vacationRequestService, {
  VacationRequest,
} from '../../services/vacationRequest.service';
import { ArrowPathIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const VacationRequestsManagement: React.FC = () => {
  const [requests, setRequests] = useState<VacationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadRequests = async () => {
    try {
      setIsLoading(true);
      const data = await vacationRequestService.getAll();
      setRequests(data);
    } catch (error) {
      console.error('Error al cargar solicitudes de vacaciones:', error);
      toast.error('Error al cargar las solicitudes de vacaciones');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRequests();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadRequests();
    setIsRefreshing(false);
    toast.success('Datos actualizados');
  };

  const handleApprove = async (request: VacationRequest) => {
    try {
      await vacationRequestService.approve(request.id);
      await loadRequests();
      toast.success('Solicitud de vacaciones aprobada');
    } catch (error) {
      console.error('Error al aprobar solicitud de vacaciones:', error);
      toast.error('Error al aprobar la solicitud');
    }
  };

  const handleReject = async (request: VacationRequest) => {
    try {
      await vacationRequestService.reject(request.id);
      await loadRequests();
      toast.success('Solicitud de vacaciones rechazada');
    } catch (error) {
      console.error('Error al rechazar solicitud de vacaciones:', error);
      toast.error('Error al rechazar la solicitud');
    }
  };

  const getStatusBadge = (status: VacationRequest['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="mt-8 bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-center py-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 bg-white rounded-2xl shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Solicitudes de vacaciones
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Gestiona las solicitudes de vacaciones enviadas por los profesionales
          </p>
        </div>
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
          Actualizar datos
        </button>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No hay solicitudes de vacaciones
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Profesional
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Inicio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fin
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Semanas
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Motivo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {requests.map((request) => {
                const startLabel = new Date(`${request.startDate}T00:00`).toLocaleDateString(
                  'es-AR'
                );
                const endLabel = new Date(`${request.endDate}T00:00`).toLocaleDateString(
                  'es-AR'
                );

                return (
                  <tr key={request.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {request.professionalId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {startLabel}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {endLabel}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {request.weeksRequested}
                    </td>
                    <td
                      className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate"
                      title={request.reason}
                    >
                      {request.reason || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(
                          request.status
                        )}`}
                      >
                        {request.status === 'pending'
                          ? 'Pendiente'
                          : request.status === 'approved'
                          ? 'Aprobada'
                          : 'Rechazada'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {request.status === 'pending' ? (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleApprove(request)}
                            className="text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1 rounded-lg transition-colors"
                            title="Aprobar solicitud"
                          >
                            <CheckIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleReject(request)}
                            className="text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-lg transition-colors"
                            title="Rechazar solicitud"
                          >
                            <XMarkIcon className="h-5 w-5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">Sin acciones</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default VacationRequestsManagement;

