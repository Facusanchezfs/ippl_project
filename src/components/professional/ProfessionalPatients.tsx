import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import patientsService from '../../services/patients.service';
import { Patient } from '../../types/Patient';
import { 
  UserIcon, 
  ArrowPathIcon,
  ArrowLeftIcon,
  ClipboardDocumentListIcon,
  UserMinusIcon,
  ClockIcon,
  EyeIcon,
  UserPlusIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import Modal from '../Modal';
import MedicalHistoryList from '../admin/MedicalHistoryList';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

interface StatusChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient;
  onSubmit: (reason: string) => Promise<void>;
}

interface FrequencyChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient;
  onSubmit: (newFrequency: 'weekly' | 'biweekly' | 'monthly', reason: string) => Promise<void>;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active':
      return 'bg-primary/10 text-primary';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'inactive':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'active':
      return 'Activo';
    case 'pending':
      return 'Pendiente';
    case 'inactive':
      return 'Inactivo';
    default:
      return status;
  }
};

const StatusChangeModal: React.FC<StatusChangeModalProps> = ({ isOpen, onClose, patient, onSubmit }) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error('Por favor, ingresa una razón para el cambio');
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit(reason);
      onClose();
    } catch (error) {
      console.error('Error al enviar solicitud:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-semibold text-red-900">
              Solicitar Inactivación de Paciente
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Esta solicitud será revisada por un administrador para inactivar al paciente.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
          </button>
        </div>

        <div className="mb-6">
          <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <UserMinusIcon className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-900">Paciente</h4>
              <p className="text-lg font-semibold text-gray-900">{patient.name}</p>
              <p className="text-sm text-gray-500">
                Estado actual: <span className={`font-medium ${getStatusColor(patient.status)}`}>
                  {getStatusLabel(patient.status)}
                </span>
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Razón de la inactivación
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500"
              rows={4}
              placeholder="Explica la razón para inactivar al paciente..."
              required
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
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Enviando...' : 'Enviar Solicitud'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

const FrequencyChangeModal: React.FC<FrequencyChangeModalProps> = ({ isOpen, onClose, patient, onSubmit }) => {
  const [newFrequency, setNewFrequency] = useState<'weekly' | 'biweekly' | 'monthly'>(patient.sessionFrequency || 'weekly');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error('Por favor, ingresa una razón para el cambio');
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit(newFrequency, reason);
      onClose();
      setReason('');
      setNewFrequency(patient.sessionFrequency || 'weekly');
    } catch (error: any) {
      console.error('Error al enviar solicitud:', error);
      const errorMessage = error.response?.data?.message || 'Error al enviar la solicitud';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFrequencyLabel = (freq: string | undefined) => {
    switch (freq) {
      case 'weekly': return 'Semanal';
      case 'biweekly': return 'Quincenal';
      case 'monthly': return 'Mensual';
      default: return 'No asignada';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Solicitar Cambio de Frecuencia
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Esta solicitud será revisada por un administrador.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
          </button>
        </div>

        <div className="mb-6">
          <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <h4 className="text-sm font-medium text-gray-900">Paciente</h4>
              <p className="text-lg font-semibold text-gray-900">{patient.name}</p>
              <p className="text-sm text-gray-500">
                Frecuencia actual: <span className="font-medium text-gray-900">
                  {getFrequencyLabel(patient.sessionFrequency)}
                </span>
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Nueva Frecuencia
            </label>
            <select
              value={newFrequency}
              onChange={(e) => setNewFrequency(e.target.value as 'weekly' | 'biweekly' | 'monthly')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            >
              <option value="weekly">Semanal</option>
              <option value="biweekly">Quincenal</option>
              <option value="monthly">Mensual</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Razón del cambio
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              rows={4}
              placeholder="Explica la razón para cambiar la frecuencia..."
              required
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
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Enviando...' : 'Enviar Solicitud'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

const StatusActivationModal: React.FC<StatusChangeModalProps> = ({ isOpen, onClose, patient, onSubmit }) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error('Por favor, ingresa una razón para la activación');
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit(reason);
      onClose();
    } catch (error) {
      console.error('Error al enviar solicitud:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-6">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-green-900">
              Solicitar Activación para el Paciente
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Esta solicitud será revisada por un administrador para activar al paciente.
            </p>
          </div>
          <button
            onClick={onClose}
            className="self-end sm:self-auto text-gray-400 hover:text-gray-500"
          >
          </button>
        </div>

        {/* Resumen Paciente */}
        <div className="mb-6">
          <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50 rounded-lg">
            <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-full flex items-center justify-center">
              <UserPlusIcon className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-medium text-gray-900">Paciente</h4>
              <p className="text-base sm:text-lg font-semibold text-gray-900 truncate">{patient.name}</p>
              <p className="text-sm text-gray-500">
                Estado actual:{' '}
                <span className={`font-medium ${getStatusColor(patient.status)}`}>
                  {getStatusLabel(patient.status)}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Razón de la activación
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
              rows={4}
              placeholder="Explica la razón para activar al paciente..."
              required
            />
          </div>

          {/* Acciones */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Enviando...' : 'Enviar Solicitud'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

const ProfessionalPatients = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'inactive'>('active');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [showMedicalHistory, setShowMedicalHistory] = useState(false);
  const [selectedPatientForHistory, setSelectedPatientForHistory] = useState<Patient | null>(null);
  const [isFrequencyModalOpen, setIsFrequencyModalOpen] = useState(false);
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);
  const [selectedPatientForDescription, setSelectedPatientForDescription] = useState<Patient | null>(null);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [isRequestActivationModalOpen, setIsRequestActivationModalOpen] = useState(false);
  const [selectedPatientForActivation, setSelectedPatientForActivation] = useState<Patient | null>(null);

  useEffect(() => {
    if (user) {
      loadPatients();
    }
  }, [user]);

  const loadPatients = async () => {
    try {
      setIsLoading(true);
      const data = await patientsService.getProfessionalPatients(user!.id);
      setPatients(data);
    } catch (error) {
      console.error('Error al cargar pacientes:', error);
      toast.error('Error al cargar los pacientes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadPatients();
    setIsRefreshing(false);
    toast.success('Datos actualizados');
  };

  const handleStatusChange = async (reason: string) => {
    if (!selectedPatient || !user) return;

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/api/patients/${selectedPatient.id}/request-discharge`,
        { reason },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      toast.success('Solicitud de baja enviada correctamente');
      setIsStatusModalOpen(false);
      setSelectedPatient(null);
    } catch (error) {
      console.error('Error al enviar solicitud:', error);
      toast.error('Error al enviar la solicitud');
    }
  };

  const handleFrequencyChange = async (newFrequency: 'weekly' | 'biweekly' | 'monthly', reason: string) => {
    if (!selectedPatient || !user) return;

    try {
      await patientsService.requestFrequencyChange(selectedPatient.id, newFrequency, reason);
      toast.success('Solicitud de cambio de frecuencia enviada correctamente');
      setIsFrequencyModalOpen(false);
      setSelectedPatient(null);
      await loadPatients();
    } catch (error: any) {
      console.error('Error al enviar solicitud:', error);
      const errorMessage = error.response?.data?.message || 'Error al enviar la solicitud';
      toast.error(errorMessage);
    }
  };

  const openStatusModal = (patient: Patient) => {
    setSelectedPatient(patient);
    setIsStatusModalOpen(true);
  };

  const openFrequencyModal = (patient: Patient) => {
    setSelectedPatient(patient);
    setIsFrequencyModalOpen(true);
  };

  const handleViewMedicalHistory = (patient: Patient) => {
    navigate(`/professional/pacientes/${patient.id}/medical-history`);
  };

  const openRequestActivationModal = (patient: Patient) => {
    setSelectedPatientForActivation(patient);
    setIsRequestActivationModalOpen(true);
  };

  const handleRequestActivation = async (reason: string) => {
    if (!selectedPatientForActivation || !user) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/api/patients/${selectedPatientForActivation.id}/request-activation`,
        { reason },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      toast.success('Solicitud de activación enviada correctamente');
      setIsRequestActivationModalOpen(false);
      setSelectedPatientForActivation(null);
      await loadPatients();
    } catch (error) {
      console.error('Error al enviar solicitud:', error);
      toast.error('Error al enviar la solicitud');
    }
  };

  const filteredPatients = patients.filter(patient => {
    const matchesSearch = patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (patient.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || patient.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getFrequencyLabel = (freq: string | undefined) => {
    switch (freq) {
      case 'weekly': return 'Semanal';
      case 'biweekly': return 'Quincenal';
      case 'monthly': return 'Mensual';
      default: return 'No asignada';
    }
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
        <div className="flex flex-col mb-[15px] md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
          {/* Izquierda: Volver + títulos */}
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
            <button
              onClick={() => navigate('/professional')}
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors w-full md:w-auto justify-center md:justify-start"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-1" />
              Volver
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Mis Pacientes</h1>
              <p className="mt-1 text-sm text-gray-500">Gestiona tus pacientes asignados</p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            className={`flex items-center px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors ${
              isRefreshing ? 'opacity-50 cursor-not-allowed' : ''
            } w-full md:w-auto justify-center`}
            disabled={isRefreshing}
          >
            <ArrowPathIcon className={`h-5 w-5 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Actualizar datos
          </button>
        </div>


        {/* Barra de búsqueda y filtros */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar pacientes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as Patient['status'])}
              className="w-full py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="pending">Pendientes</option>
              <option value="inactive">Inactivos</option>
            </select>
          </div>
        </div>

        {/* Resumen de filtros */}
        <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
          <span>
            Mostrando {filteredPatients.length} de {patients.length} pacientes
          </span>
          {searchTerm && (
            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
              Búsqueda: {searchTerm}
            </span>
          )}
          {statusFilter !== 'all' && (
            <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full">
              Estado: {statusFilter === 'active' ? 'Activo' : statusFilter === 'pending' ? 'Pendiente' : statusFilter === 'inactive' ? 'Inactivo' : 'Todos'}
            </span>
          )}
        </div>

        {/* Tabla de pacientes */}
        {/* ===== MOBILE/TABLET: CARDS ===== */}
        <div className="block md:hidden space-y-3 mt-8">
          {filteredPatients.map((patient) => (
            <div
              key={patient.id}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
            >
              {/* Header: Nombre + estado */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-gray-900 truncate">
                    {patient.name}
                  </h3>
                  {patient.email && (
                    <p className="text-sm text-gray-500 truncate">{patient.email}</p>
                  )}
                </div>

                <span
                  className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                    patient.status
                  )}`}
                >
                  {getStatusLabel(patient.status)}
                </span>
              </div>

              {/* Fecha de asignación + frecuencia */}
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded bg-gray-50 p-2">
                  <div className="text-gray-500">Fecha de Asignación</div>
                  <div className="font-medium text-gray-900">
                    {patient.assignedAt
                      ? new Date(patient.assignedAt).toLocaleDateString()
                      : '-'}
                  </div>
                </div>
                <div className="rounded bg-gray-50 p-2">
                  <div className="text-gray-500">Frecuencia</div>
                  <div>
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        patient.sessionFrequency
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {getFrequencyLabel(patient.sessionFrequency)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Nota de Texto */}
              <div className="mt-3">
                <div className="text-sm text-gray-500 mb-1">Nota</div>
                {patient.textNote ? (
                  <div>
                    <p className="text-sm text-gray-700 line-clamp-3 break-words">
                      {patient.textNote}
                    </p>
                    {patient.textNote.length > 100 && (
                      <button
                        onClick={() => {
                          setSelectedPatientForDescription(patient);
                          setShowNoteModal(true);
                        }}
                        className="mt-1 text-xs text-blue-600 hover:text-blue-800"
                      >
                        Ver nota completa
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="text-gray-400 text-sm">-</span>
                )}
              </div>

              {/* Audio */}
              <div className="mt-3">
                <div className="text-sm text-gray-500 mb-1">Audios</div>
                {patient.audioNote ? (
                  <div className="flex items-center">
                    <audio
                      controls
                      className="w-full h-10"
                      controlsList="nodownload"
                      preload="metadata"
                    >
                      <source src={patient.audioNote} type="audio/webm" />
                      <source src={patient.audioNote} type="audio/ogg" />
                      <source src={patient.audioNote} type="audio/mpeg" />
                      Tu navegador no soporta el elemento de audio.
                    </audio>
                  </div>
                ) : (
                  <span className="text-gray-400 text-sm">-</span>
                )}
              </div>

              {/* Acciones */}
              <div className="mt-3 flex flex-wrap justify-end gap-3">
                <button
                  onClick={() => {
                    setSelectedPatientForDescription(patient);
                    setShowDescriptionModal(true);
                  }}
                  className="text-blue-600 hover:text-blue-900 inline-flex items-center"
                  title="Ver descripción"
                >
                  <EyeIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={() => handleViewMedicalHistory(patient)}
                  className="text-blue-600 hover:text-blue-900 inline-flex items-center"
                  title="Ver historial médico"
                >
                  <ClipboardDocumentListIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={() => openFrequencyModal(patient)}
                  className="text-blue-600 hover:text-blue-900 inline-flex items-center"
                  title="Cambiar frecuencia"
                >
                  <ClockIcon className="h-5 w-5" />
                </button>
                {patient.status !== 'inactive' && (
                  <button
                    onClick={() => openStatusModal(patient)}
                    className="text-red-600 hover:text-red-900 inline-flex items-center"
                    title="Solicitar baja"
                  >
                    <UserMinusIcon className="h-5 w-5" />
                  </button>
                )}
                {patient.status === 'inactive' && (
                  <button
                    onClick={() => openRequestActivationModal(patient)}
                    className="text-green-600 hover:text-green-900 inline-flex items-center"
                    title="Solicitar activación"
                  >
                    <UserPlusIcon className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ===== DESKTOP: TABLA ORIGINAL ===== */}
        <div className="hidden md:block">
          <div className="mt-8 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nombre
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha de Asignación
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Frecuencia
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nota
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Audios
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPatients.map((patient) => (
                <tr key={patient.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {patient.name}
                        </div>
                        {patient.email && (
                          <div className="text-sm text-gray-500">
                            {patient.email}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(patient.status)}`}>
                      {getStatusLabel(patient.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {patient.assignedAt ? new Date(patient.assignedAt).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      patient.sessionFrequency ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {getFrequencyLabel(patient.sessionFrequency)}
                    </span>
                  </td>
                  <td className="px-6 py-4 min-w-[200px] max-w-[300px]">
                    {patient.textNote ? (
                      <div className="max-w-xs">
                        <p className="text-sm text-gray-600 line-clamp-2 break-words">
                          {patient.textNote}
                        </p>
                        {patient.textNote.length > 100 && (
                          <button
                            onClick={() => {
                              setSelectedPatientForDescription(patient);
                              setShowNoteModal(true);
                            }}
                            className="mt-1 text-xs text-blue-600 hover:text-blue-800"
                          >
                            Ver nota completa
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 min-w-[200px]">
                    {patient.audioNote ? (
                      <div className="flex items-center space-x-2">
                        <audio
                          controls
                          className="min-w-[200px] max-w-full h-10"
                          controlsList="nodownload"
                          preload="metadata"
                        >
                          <source src={patient.audioNote} type="audio/webm" />
                          <source src={patient.audioNote} type="audio/ogg" />
                          <source src={patient.audioNote} type="audio/mpeg" />
                          Tu navegador no soporta el elemento de audio.
                        </audio>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button
                      onClick={() => {
                        setSelectedPatientForDescription(patient);
                        setShowDescriptionModal(true);
                      }}
                      className="text-blue-600 hover:text-blue-900"
                      title="Ver descripción"
                    >
                      <EyeIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleViewMedicalHistory(patient)}
                      className="text-blue-600 hover:text-blue-900"
                      title="Ver historial médico"
                    >
                      <ClipboardDocumentListIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => openFrequencyModal(patient)}
                      className="text-blue-600 hover:text-blue-900"
                      title="Cambiar frecuencia"
                    >
                      <ClockIcon className="h-5 w-5" />
                    </button>
                    {patient.status !== 'inactive' && (
                      <button
                        onClick={() => openStatusModal(patient)}
                        className="text-red-600 hover:text-red-900"
                        title="Solicitar baja"
                      >
                        <UserMinusIcon className="h-5 w-5" />
                      </button>
                    )}
                    {patient.status === 'inactive' && (
                      <button
                        onClick={() => openRequestActivationModal(patient)}
                        className="text-green-600 hover:text-green-900"
                        title="Solicitar activación"
                      >
                        <UserPlusIcon className="h-5 w-5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        {/* ===== EMPTY STATE (para ambos tamaños) ===== */}
        {filteredPatients.length === 0 && (
          <div className="text-center py-12">
            <UserIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              No se encontraron pacientes
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm
                ? 'Intenta con otros términos de búsqueda'
                : 'Aún no tienes pacientes asignados'}
            </p>
          </div>
        )}
      </div>

      {/* Modal de cambio de estado */}
      {selectedPatient && (
        <StatusChangeModal
          isOpen={isStatusModalOpen}
          onClose={() => {
            setIsStatusModalOpen(false);
            setSelectedPatient(null);
          }}
          patient={selectedPatient}
          onSubmit={handleStatusChange}
        />
      )}

      {/* Modal de Historial Médico */}
      <Modal isOpen={showMedicalHistory} onClose={() => setShowMedicalHistory(false)}>
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Historial Médico - {selectedPatientForHistory?.name}
            </h3>
            <button
              onClick={() => setShowMedicalHistory(false)}
              className="text-gray-400 hover:text-gray-500"
            >
              <span className="sr-only">Cerrar</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {selectedPatientForHistory && (
            <MedicalHistoryList
              patientId={selectedPatientForHistory.id}
              isAdmin={false}
            />
          )}
        </div>
      </Modal>

      {/* Modal de cambio de frecuencia */}
      {selectedPatient && (
        <FrequencyChangeModal
          isOpen={isFrequencyModalOpen}
          onClose={() => {
            setIsFrequencyModalOpen(false);
            setSelectedPatient(null);
          }}
          patient={selectedPatient}
          onSubmit={handleFrequencyChange}
        />
      )}

      {/* Modal de descripción */}
      {showDescriptionModal && selectedPatientForDescription && (
        <Modal isOpen={showDescriptionModal} onClose={() => setShowDescriptionModal(false)}>
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                Detalles del Paciente
              </h3>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-500">Nombre</h4>
                <p className="mt-1 text-sm text-gray-900">{selectedPatientForDescription.name}</p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-500">Estado</h4>
                <p className="mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedPatientForDescription.status)}`}>
                    {getStatusLabel(selectedPatientForDescription.status)}
                  </span>
                </p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-500">Frecuencia de Sesiones</h4>
                <p className="mt-1 text-sm text-gray-900">
                  {getFrequencyLabel(selectedPatientForDescription.sessionFrequency)}
                </p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-500">Fecha de Asignación</h4>
                <p className="mt-1 text-sm text-gray-900">
                  {selectedPatientForDescription?.assignedAt
                    ? new Date(selectedPatientForDescription.assignedAt).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })
                    : 'Sin asignar'}
                </p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-500">Notas</h4>
                <p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">
                  {selectedPatientForDescription.description || 'Sin notas'}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={() => setShowDescriptionModal(false)}
                className="w-full inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-transparent rounded-lg hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-500"
              >
                Cerrar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de nota completa */}
      {showNoteModal && selectedPatientForDescription && (
        <Modal isOpen={showNoteModal} onClose={() => {
          setShowNoteModal(false);
          setSelectedPatientForDescription(null);
        }}>
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                Nota Completa - {selectedPatientForDescription.name}
              </h3>
              <button
                onClick={() => {
                  setShowNoteModal(false);
                  setSelectedPatientForDescription(null);
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <span className="sr-only">Cerrar</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">Nota de Texto</h4>
                <p className="text-sm text-gray-900 whitespace-pre-wrap break-words bg-gray-50 p-4 rounded-md">
                  {selectedPatientForDescription.textNote || 'Sin nota de texto'}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={() => {
                  setShowNoteModal(false);
                  setSelectedPatientForDescription(null);
                }}
                className="w-full inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-transparent rounded-lg hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-500"
              >
                Cerrar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {selectedPatientForActivation && (
        <StatusActivationModal
          isOpen={isRequestActivationModalOpen}
          onClose={() => {
            setIsRequestActivationModalOpen(false);
            setSelectedPatientForActivation(null);
          }}
          patient={selectedPatientForActivation}
          onSubmit={handleRequestActivation}
        />
      )}
    </div>
  );
};

export default ProfessionalPatients; 