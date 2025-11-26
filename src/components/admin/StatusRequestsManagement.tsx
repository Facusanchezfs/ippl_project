import React, { useState, useEffect } from 'react';
import statusRequestService from '../../services/statusRequest.service';
import { StatusRequest } from '../../types/StatusRequest';
import { ArrowPathIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import Modal from '../Modal';

interface ResponseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (response: string, approve: boolean) => Promise<void>;
  isApproving: boolean;
}

const ResponseModal: React.FC<ResponseModalProps> = ({ isOpen, onClose, onSubmit, isApproving }) => {
  const [response, setResponse] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!response.trim() && !isApproving) {
      toast.error('Por favor, ingresa una respuesta');
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit(response, isApproving);
      onClose();
    } catch (error) {
      console.error('Error al enviar respuesta:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {isApproving ? 'Aprobar Solicitud' : 'Rechazar Solicitud'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {isApproving ? 'Comentarios (opcional)' : 'Razón del rechazo'}
            </label>
            <textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              rows={4}
              placeholder={isApproving ? 'Añade comentarios adicionales...' : 'Explica la razón del rechazo...'}
              required={!isApproving}
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                isApproving ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
              } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isSubmitting ? 'Enviando...' : isApproving ? 'Aprobar' : 'Rechazar'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

const StatusRequestsManagement = () => {
  const [requests, setRequests] = useState<StatusRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<StatusRequest | null>(null);
  const [isResponseModalOpen, setIsResponseModalOpen] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      setIsLoading(true);
      const data = await statusRequestService.getPendingRequests();
      setRequests(data);
    } catch (error) {
      console.error('Error al cargar solicitudes:', error);
      toast.error('Error al cargar las solicitudes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadRequests();
    setIsRefreshing(false);
    toast.success('Datos actualizados');
  };

  const handleResponse = async (response: string, approve: boolean) => {
    if (!selectedRequest) return;

    try {
      if (approve) {
        await statusRequestService.approveRequest(selectedRequest.id, response);
      } else {
        await statusRequestService.rejectRequest(selectedRequest.id, response);
      }
      await loadRequests();
      toast.success(approve ? 'Solicitud aprobada' : 'Solicitud rechazada');
    } catch (error) {
      console.error('Error al procesar solicitud:', error);
      toast.error('Error al procesar la solicitud');
    }
  };

  const openResponseModal = (request: StatusRequest, approve: boolean) => {
    setSelectedRequest(request);
    setIsApproving(approve);
    setIsResponseModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Solicitudes de Cambio de Estado
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Gestiona las solicitudes de cambio de estado de pacientes
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className={`flex items-center px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors ${isRefreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isRefreshing}
          >
            <ArrowPathIcon className={`h-5 w-5 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Actualizar datos
          </button>
        </div>

        {requests.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Paciente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Profesional
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado Actual
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado Solicitado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Razón
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo de Solicitud
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {requests.map((request) => (
                  <tr key={request.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{request.patientName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{request.professionalName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        request.currentStatus === 'active' ? 'bg-primary/10 text-primary' :
                        request.currentStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        request.currentStatus === 'inactive' ? 'bg-gray-100 text-gray-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {request.currentStatus === 'active' ? 'Activo' :
                         request.currentStatus === 'pending' ? 'Pendiente' :
                         request.currentStatus === 'inactive' ? 'Inactivo' :
                         'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        request.requestedStatus === 'active' ? 'bg-primary/10 text-primary' :
                        request.requestedStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        request.requestedStatus === 'inactive' ? 'bg-gray-100 text-gray-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {request.requestedStatus === 'active' ? 'Activo' :
                         request.requestedStatus === 'pending' ? 'Pendiente' :
                         request.requestedStatus === 'inactive' ? 'Inactivo' :
                         'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate" title={request.reason}>
                        {request.reason}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(request.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${request.type === 'activation' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{request.type === 'activation' ? 'Activación' : 'Cambio de estado'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openResponseModal(request, true)}
                          className="text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1 rounded-lg transition-colors"
                        >
                          <CheckIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => openResponseModal(request, false)}
                          className="text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-lg transition-colors"
                        >
                          <XMarkIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="mx-auto h-12 w-12 text-gray-400">
              <svg className="h-full w-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay solicitudes pendientes</h3>
            <p className="mt-1 text-sm text-gray-500">
              No hay solicitudes de cambio de estado pendientes de revisión
            </p>
          </div>
        )}
      </div>

      {/* Modal de respuesta */}
      {selectedRequest && (
        <ResponseModal
          isOpen={isResponseModalOpen}
          onClose={() => {
            setIsResponseModalOpen(false);
            setSelectedRequest(null);
          }}
          onSubmit={handleResponse}
          isApproving={isApproving}
        />
      )}
    </div>
  );
};

export default StatusRequestsManagement; 