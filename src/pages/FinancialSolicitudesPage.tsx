import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import patientsService from '../services/patients.service';
import frequencyRequestService, { FrequencyRequest } from '../services/frequencyRequest.service';
import statusRequestService from '../services/statusRequest.service';
import { StatusRequest } from '../types/StatusRequest';
import { Patient } from '../types/Patient';
import { AdjustmentsHorizontalIcon, XCircleIcon, CheckCircleIcon, ArrowLeftIcon, MagnifyingGlassIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

const translateFrequency = (frequency?: FrequencyRequest['requestedFrequency']) => {
  switch (frequency) {
    case 'weekly':
      return 'Semanal';
    case 'biweekly':
      return 'Quincenal';
    case 'monthly':
      return 'Mensual';
    default:
      return 'Sin asignar';
  }
};

const translateRequestStatus = (status: FrequencyRequest['status'] | StatusRequest['status']) => {
  switch (status) {
    case 'pending':
      return 'Pendiente';
    case 'approved':
      return 'Aprobada';
    case 'rejected':
      return 'Rechazada';
    default:
      return status;
  }
};

const translatePatientStatus = (status: Patient['status']) => {
  switch (status) {
    case 'active':
      return 'Activo';
    case 'pending':
      return 'Pendiente';
    case 'inactive':
      return 'Inactivo';
    case 'absent':
      return 'Ausente';
    case 'alta':
      return 'Alta';
    default:
      return status;
  }
};

const PATIENTS_PER_PAGE = 10;

const FinancialSolicitudesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [frequencyRequests, setFrequencyRequests] = useState<FrequencyRequest[]>([]);
  const [statusRequests, setStatusRequests] = useState<StatusRequest[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'frequency' | 'inactive' | 'alta' | null>(null);
  
  // Estados para búsqueda, paginación y ordenamiento
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    setLoading(true);
    const data = await patientsService.getAllPatients();
    setPatients(data);
    setLoading(false);
  };

  // Filtrar pacientes por búsqueda (que comience con el término en nombre o apellido)
  const filteredPatients = useMemo(() => {
    if (!searchTerm.trim()) {
      return patients;
    }
    
    const searchLower = searchTerm.toLowerCase().trim();
    return patients.filter(patient => {
      const nameParts = patient.name.toLowerCase().split(/\s+/);
      // Buscar si algún nombre o apellido comienza con el término de búsqueda
      return nameParts.some(part => part.startsWith(searchLower));
    });
  }, [patients, searchTerm]);

  // Ordenar pacientes alfabéticamente
  const sortedPatients = useMemo(() => {
    const sorted = [...filteredPatients].sort((a, b) => {
      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();
      return sortOrder === 'asc' 
        ? nameA.localeCompare(nameB, 'es', { sensitivity: 'base' })
        : nameB.localeCompare(nameA, 'es', { sensitivity: 'base' });
    });
    return sorted;
  }, [filteredPatients, sortOrder]);

  // Paginar pacientes
  const paginatedPatients = useMemo(() => {
    const startIndex = (currentPage - 1) * PATIENTS_PER_PAGE;
    return sortedPatients.slice(startIndex, startIndex + PATIENTS_PER_PAGE);
  }, [sortedPatients, currentPage]);

  const totalPages = Math.ceil(sortedPatients.length / PATIENTS_PER_PAGE);

  // Resetear página cuando cambia la búsqueda
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleViewFrequencyRequests = async (patient: Patient) => {
    setSelectedPatient(patient);
    setModalType('frequency');
    setShowModal(true);
    const requests = await frequencyRequestService.getPatientRequests(patient.id);
    setFrequencyRequests(requests);
  };

  const handleViewStatusRequests = async (patient: Patient, type: 'inactive' | 'alta') => {
    setSelectedPatient(patient);
    setModalType(type);
    setShowModal(true);
    // Usar el nuevo endpoint que filtra por paciente
    const allRequests = await statusRequestService.getPatientPendingRequests(patient.id);
    // Filtrar solo por tipo de solicitud
    const filtered = allRequests.filter(r => r.requestedStatus === type);
    setStatusRequests(filtered);
  };

  let tableRows: React.ReactNode;

  if (loading) {
    tableRows = (
      <tr><td colSpan={3} className="text-center py-6">Cargando...</td></tr>
    );
  } else if (searchTerm && sortedPatients.length === 0) {
    tableRows = (
      <tr><td colSpan={3} className="text-center py-6 text-gray-500">No se encontraron pacientes que coincidan con la búsqueda "{searchTerm}"</td></tr>
    );
  } else if (patients.length === 0 || sortedPatients.length === 0) {
    tableRows = (
      <tr><td colSpan={3} className="text-center py-6">No hay pacientes registrados</td></tr>
    );
  } else {
    tableRows = paginatedPatients.map((patient, idx) => (
      <tr key={patient.id} className={`transition-colors ${idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-blue-50`}>
        <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap text-base">{patient.name}</td>
        <td className="px-6 py-4 text-gray-700 whitespace-nowrap capitalize text-base">{translatePatientStatus(patient.status)}</td>
        <td className="px-6 py-4 flex gap-4 items-center justify-center">
          <button
            className="group p-2 rounded-full hover:bg-blue-100 transition"
            title="Ver Solicitud de Frecuencia"
            onClick={() => handleViewFrequencyRequests(patient)}
          >
            <AdjustmentsHorizontalIcon className="h-6 w-6 text-blue-600 group-hover:text-blue-800" />
          </button>
          <button
            className="group p-2 rounded-full hover:bg-yellow-100 transition"
            title="Ver Solicitud Inactivo"
            onClick={() => handleViewStatusRequests(patient, 'inactive')}
          >
            <XCircleIcon className="h-6 w-6 text-yellow-500 group-hover:text-yellow-700" />
          </button>
          <button
            className="group p-2 rounded-full hover:bg-green-100 transition"
            title="Ver Solicitud Alta"
            onClick={() => handleViewStatusRequests(patient, 'alta')}
          >
            <CheckCircleIcon className="h-6 w-6 text-green-600 group-hover:text-green-800" />
          </button>
        </td>
      </tr>
    ));
  }

  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-8">
        {user?.role === 'admin' && (
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Volver al Dashboard
          </button>
        )}
        <h1 className="text-3xl font-extrabold text-gray-800">Solicitudes de Pacientes</h1>
      </div>

      {/* Barra de búsqueda y controles */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o apellido..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Ordenar:</span>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
          >
            {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
          </button>
        </div>
      </div>

      {/* Información de resultados */}
      {!loading && sortedPatients.length > 0 && (
        <div className="mb-4 text-sm text-gray-600">
          Mostrando {((currentPage - 1) * PATIENTS_PER_PAGE) + 1} - {Math.min(currentPage * PATIENTS_PER_PAGE, sortedPatients.length)} de {sortedPatients.length} pacientes
        </div>
      )}

      <div className="overflow-x-auto mb-6">
        <table className="min-w-full bg-white border rounded-xl shadow">
          <thead>
            <tr className="bg-gradient-to-r from-blue-600 to-blue-400 text-white">
              <th className="px-6 py-3 text-left text-lg font-semibold rounded-tl-xl">Nombre</th>
              <th className="px-6 py-3 text-left text-lg font-semibold">Estado</th>
              <th className="px-6 py-3 text-center text-lg font-semibold rounded-tr-xl">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {tableRows}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {!loading && sortedPatients.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          
          <span className="px-4 py-2 text-sm text-gray-700">
            Página {currentPage} de {totalPages}
          </span>
          
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Modal para mostrar solicitudes */}
      {showModal && selectedPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg max-h-[85vh] flex flex-col relative">
            {/* Header fijo */}
            <div className="p-6 pb-4 border-b border-gray-200 flex-shrink-0">
              <button
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-xl font-bold w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
              <h2 className="text-xl font-bold pr-8">Solicitudes de {selectedPatient.name}</h2>
            </div>
            
            {/* Contenido scrolleable */}
            <div className="p-6 pt-4 overflow-y-auto flex-1">
              {modalType === 'frequency' && (
                <div>
                  <h3 className="font-semibold mb-2">Solicitudes de Cambio de Frecuencia</h3>
                  {frequencyRequests.length === 0 ? (
                    <p>No hay solicitudes de cambio de frecuencia.</p>
                  ) : (
                    <ul className="space-y-2">
                      {frequencyRequests.map(req => (
                        <li key={req.id} className="border p-2 rounded">
                          <div><b>Solicitado:</b> {translateFrequency(req.currentFrequency)} → {translateFrequency(req.requestedFrequency)}</div>
                          <div><b>Motivo:</b> {req.reason}</div>
                          <div><b>Estado:</b> {translateRequestStatus(req.status)}</div>
                          <div><b>Fecha:</b> {new Date(req.createdAt).toLocaleString('es-ES')}</div>
                          {req.adminResponse && <div><b>Respuesta Admin:</b> {req.adminResponse}</div>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {modalType !== 'frequency' && (() => {
                const modalTitle = modalType === 'inactive' 
                  ? 'Solicitudes de Inactivación/Baja' 
                  : modalType === 'alta'
                  ? 'Solicitudes de Alta'
                  : 'Solicitudes de Cambio de Estado';
                
                const emptyMessage = modalType === 'inactive' 
                  ? 'de inactivación/baja' 
                  : modalType === 'alta' 
                  ? 'de alta' 
                  : 'de este tipo';
                
                return (
                  <div>
                    <h3 className="font-semibold mb-2">{modalTitle}</h3>
                    {statusRequests.length === 0 ? (
                      <p>No hay solicitudes {emptyMessage} pendientes.</p>
                    ) : (
                      <ul className="space-y-2">
                        {statusRequests.map(req => (
                          <li key={req.id} className="border p-2 rounded">
                            <div><b>Estado Actual:</b> {translatePatientStatus(req.currentStatus)}</div>
                            <div><b>Solicitado:</b> {translatePatientStatus(req.requestedStatus)}</div>
                            <div><b>Motivo:</b> {req.reason}</div>
                            <div><b>Estado Solicitud:</b> {translateRequestStatus(req.status)}</div>
                            <div><b>Fecha:</b> {new Date(req.createdAt).toLocaleString('es-ES')}</div>
                            {req.adminResponse && <div><b>Respuesta Admin:</b> {req.adminResponse}</div>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialSolicitudesPage; 