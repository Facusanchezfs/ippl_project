import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import appointmentsService from '../../services/appointments.service';
import patientsService from '../../services/patients.service';
import { Appointment, AppointmentStatus } from '../../types/Appointment';
import { Patient } from '../../types/Patient';
import { getFriendlyErrorMessage, ErrorMessages } from '../../utils/errorMessages';
import { 
  CalendarIcon, 
  ClockIcon,
  UserIcon,
  ArrowPathIcon,
  ArrowLeftIcon,
  PlusIcon,
  CurrencyDollarIcon,
  PencilIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  EyeIcon,
  XMarkIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import ConfirmationModal from '../../components/common/ConfirmationModal';

const AppointmentsPage = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showNewAppointmentModal, setShowNewAppointmentModal] = useState(false);
  const [showEditAppointmentModal, setShowEditAppointmentModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'upcoming' | 'past'>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);
  const [selectedAppointmentForDescription, setSelectedAppointmentForDescription] = useState<Appointment | null>(null);
  const [showFinishAppointmentModal, setShowFinishAppointmentModal] = useState(false);
  const [selectedAppointmentForFinish, setSelectedAppointmentForFinish] = useState<Appointment | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [attended, setAttended] = useState<boolean>(true);
  const [remainingBalance, setRemainingBalance] = useState<number>(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState<Appointment | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadAppointments();
    if (user) {
      loadPatients();
    }
  }, [user]);

  const loadPatients = async () => {
    try {
      const data = await patientsService.getProfessionalPatients(user!.id);
      const activePatients = data.filter(patient => patient.status === 'active');
      setPatients(activePatients);
    } catch (error) {
      console.error('Error al cargar pacientes:', error);
      const friendlyMessage = getFriendlyErrorMessage(error, ErrorMessages.PATIENT_LOAD_FAILED);
      toast.error(friendlyMessage);
    }
  };

  const loadAppointments = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      const data = await appointmentsService.getProfessionalAppointments(user.id);
      setAppointments(data);
    } catch (error) {
      console.error('Error al cargar las citas:', error);
      const friendlyMessage = getFriendlyErrorMessage(error, ErrorMessages.APPOINTMENT_LOAD_FAILED);
      toast.error(friendlyMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const combineLocalDateTime = (dateStr: string, timeStr?: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  let hh = 0, mm = 0;
  if (timeStr) {
    [hh, mm] = timeStr.split(':').map(Number);
  }
  // Date(...) sin zona -> crea un Date en TU zona local
  return new Date(y, (m - 1), d, hh, mm);
}

  // Función helper para formatear fecha en formato dd/MM/yyyy HH:mm
  const formatDateTime = (dateStr: string, timeStr?: string) => {
    const date = combineLocalDateTime(dateStr, timeStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadAppointments();
    setIsRefreshing(false);
    toast.success('Datos actualizados');
  };

  const getAppointmentStatus = (status: string) => {
    switch(status){
      case AppointmentStatus.scheduled:
        return {label: 'Pendiente', class: 'bg-yellow-100 text-yellow-800'}
      case AppointmentStatus.completed:
        return {label: 'Finalizada', class: 'bg-gray-100 text-gray-800'}
      case AppointmentStatus.cancelled:
        return {label: 'Cancelada', class: 'bg-red-100 text-red-800'}
      default:
        return {label: '', class: ''};
    }
  };

  const handleCreateAppointment = async (appointmentData: Partial<Appointment>) => {
    try {
      const selectedPatient = patients.find(p => p.id === appointmentData.patientId);
      if (!selectedPatient) {
        toast.error('Por favor selecciona un paciente válido');
        return;
      }

      await appointmentsService.createAppointment({
        ...appointmentData,
        professionalId: user!.id,
        professionalName: user!.name,
        patientName: selectedPatient.name,
        status: 'scheduled'
      });
      
      await loadAppointments();
      setShowNewAppointmentModal(false);
      toast.success('Cita creada exitosamente');
    } catch (error) {
      console.error('Error al crear la cita:', error);
      toast.error('Error al crear la cita');
    }
  };

  const toMinutes = (hhmm: string) => {
    const [h, m] = (hhmm || '').split(':').map(Number);
    return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
  };

  const fromMinutes = (mins: number) => {
    const h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  };

  const addMinutesToTime = (hhmm: string, minutesToAdd: number) => {
    const total = toMinutes(hhmm) + minutesToAdd;
    return fromMinutes(total);
  };

  const handleEditAppointment = async (appointmentData: Partial<Appointment>) => {
    try {
      if (!selectedAppointment) return;

      await appointmentsService.updateAppointment(selectedAppointment.id, {
        ...appointmentData,
        status: 'scheduled'
      });
      
      await loadAppointments();
      setShowEditAppointmentModal(false);
      setSelectedAppointment(null);
      toast.success('Cita actualizada exitosamente');
    } catch (error) {
      console.error('Error al actualizar la cita:', error);
      toast.error('Error al actualizar la cita');
    }
  };

  const handleDeleteClick = (appointment: Appointment) => {
    setAppointmentToDelete(appointment);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!appointmentToDelete) return;

    try {
      await appointmentsService.deleteAppointment(appointmentToDelete.id, appointmentToDelete);
      await loadAppointments();
      toast.success('Cita eliminada exitosamente');
      setShowDeleteModal(false);
      setAppointmentToDelete(null);
    } catch (error) {
      console.error('Error al eliminar la cita:', error);
      toast.error(error instanceof Error ? error.message : 'Error al eliminar la cita');
    }
  };

  const handleFinishAppointment = async (appointmentId: string, finishData: {
    attended: boolean;
    paymentAmount: number;
    remainingBalance: number;
  }) => {
    try {
      await appointmentsService.updateAppointment(appointmentId, {
        status: 'completed',
        attended: finishData.attended,
        paymentAmount: finishData.paymentAmount,
        remainingBalance: finishData.remainingBalance,
        completedAt: new Date().toISOString()
      });
      
      // Buscar el appointment para obtener el patientId
      const appointment = appointments.find(a => a.id === appointmentId);
      if (appointment && finishData.attended === false) {
        // Cambiar el estado del paciente a 'inactive' si no asistió y mantener la asociación con el profesional
        await patientsService.updatePatient(appointment.patientId, {
          status: 'inactive',
          professionalId: appointment.professionalId,
          professionalName: appointment.professionalName
        });
      }
      
      await loadAppointments();
      setShowFinishAppointmentModal(false);
      setSelectedAppointmentForFinish(null);
      setPaymentAmount(0);
      setAttended(true);
      setRemainingBalance(0);
      toast.success('Cita finalizada exitosamente');
    } catch (error) {
      console.error('Error al finalizar la cita:', error);
      toast.error('Error al finalizar la cita');
    }
  };

  const filteredAppointments = appointments
    .filter(appointment => appointment.status != 'completed')
    .filter(appointment => {
    // Usar combineLocalDateTime para obtener fecha+hora completa en zona local
    const appointmentDateTime = combineLocalDateTime(appointment.date, appointment.startTime);
    const now = new Date();

    switch (filterStatus) {
      case 'upcoming':
        return appointmentDateTime >= now;
      case 'past':
        return appointmentDateTime < now;
      default:
        return true;
    }
    })
    .sort((a, b) => {
    // Ordenar por fecha+hora completa
    const dateA = combineLocalDateTime(a.date, a.startTime).getTime();
    const dateB = combineLocalDateTime(b.date, b.startTime).getTime();
    return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
          {/* Bloque izquierda */}
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <button
              onClick={() => navigate('/professional')}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              Volver al Dashboard
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Gestión de Citas</h1>
            </div>
          </div>

          {/* Bloque derecha */}
          <div className="flex flex-wrap items-center gap-4 md:justify-end">
            <button
              onClick={() => setShowNewAppointmentModal(true)}
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Nueva Cita
            </button>
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
            <button
              onClick={() => navigate('/professional/calendario')}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <CalendarIcon className="h-5 w-5 mr-2" />
              Ver Calendario
            </button>
          </div>
        </div>


        {/* Filtros y Ordenamiento */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'all' | 'upcoming' | 'past')}
              className="rounded-lg border-gray-300 text-sm"
            >
              <option value="all">Todas las citas</option>
              <option value="upcoming">Citas próximas</option>
              <option value="past">Citas pasadas</option>
            </select>
          </div>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="flex items-center px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            {sortOrder === 'asc' ? (
              <ChevronUpIcon className="h-5 w-5 mr-1" />
            ) : (
              <ChevronDownIcon className="h-5 w-5 mr-1" />
            )}
            Ordenar por fecha
          </button>
        </div>
        
        {filteredAppointments.length > 0 ? (
          <>
            {/* ===== MOBILE/TABLET: CARDS ===== */}
            <div className="block md:hidden space-y-3">
              {filteredAppointments.map((appointment) => {
                const status = getAppointmentStatus(appointment.status);
                return (
                  <div
                    key={appointment.id}
                    className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    {/* Paciente */}
                    <div className="flex items-start gap-3">
                      <UserIcon className="h-6 w-6 text-gray-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-base font-semibold text-gray-900 truncate">
                          {appointment.patientName}
                        </div>
                      </div>
                    </div>

                    {/* Fecha y hora */}
                    <div className="mt-2 flex items-center text-sm text-gray-700">
                      <ClockIcon className="h-4 w-4 mr-1 shrink-0 text-gray-400" />
                      <span className="truncate">
                        {formatDateTime(appointment.date, appointment.startTime)}
                      </span>
                    </div>

                    {/* Estado + Tipo */}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${status.class}`}
                      >
                        {status.label}
                      </span>
                      <span className="text-xs rounded px-2 py-1 bg-gray-100 text-gray-700">
                        {appointment.type === 'regular'
                          ? 'Regular'
                          : appointment.type === 'first_time'
                          ? 'Primera Vez'
                          : 'Emergencia'}
                      </span>
                    </div>

                    {/* Precio */}
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded bg-gray-50 p-2">
                        <div className="text-gray-500">Precio</div>
                        <div className="font-medium text-gray-900">
                          ${appointment.sessionCost?.toFixed(2) || '0.00'}
                        </div>
                      </div>
                    </div>

                    {/* Acciones (mismas que en la tabla) */}
                    <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
                      <button
                        onClick={() => {
                          setSelectedAppointmentForDescription(appointment);
                          setShowDescriptionModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-900 inline-flex items-center"
                        title="Ver descripción"
                      >
                        <EyeIcon className="h-5 w-5" />
                      </button>

                      <button
                        onClick={() => {
                          setSelectedAppointment(appointment);
                          setShowEditAppointmentModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-900 inline-flex items-center"
                        title="Editar cita"
                      >
                        <PencilIcon className="h-5 w-5" />
                      </button>

                      <button
                        onClick={() => {
                          setSelectedAppointmentForFinish(appointment);
                          setPaymentAmount(appointment.sessionCost || 0);
                          setShowFinishAppointmentModal(true);
                        }}
                        className="text-green-600 hover:text-green-900 inline-flex items-center"
                        title="Finalizar cita"
                      >
                        <CheckCircleIcon className="h-5 w-5" />
                      </button>

                      <button
                        onClick={() => handleDeleteClick(appointment)}
                        className="text-red-600 hover:text-red-900 inline-flex items-center"
                        title="Eliminar cita"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ===== DESKTOP: TABLA ORIGINAL ===== */}
            <div className="hidden md:block">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  {/* ⬇️ tu thead/tbody original sin cambios */}
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Paciente
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fecha y Hora
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tipo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Precio
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredAppointments.map((appointment) => {
                      const status = getAppointmentStatus(appointment.status);
                      return (
                        <tr key={appointment.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0">
                                <UserIcon className="h-6 w-6 text-gray-400" />
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">
                                  {appointment.patientName}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <ClockIcon className="h-5 w-5 text-gray-400 mr-2" />
                              <span className="text-sm text-gray-900">
                                {formatDateTime(appointment.date, appointment.startTime)}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${status.class}`}
                            >
                              {status.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {appointment.type === 'regular'
                              ? 'Regular'
                              : appointment.type === 'first_time'
                              ? 'Primera Vez'
                              : 'Emergencia'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            ${appointment.sessionCost?.toFixed(2) || '0.00'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => {
                                setSelectedAppointmentForDescription(appointment);
                                setShowDescriptionModal(true);
                              }}
                              className="text-blue-600 hover:text-blue-900 mr-4"
                              title="Ver descripción"
                            >
                              <EyeIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedAppointment(appointment);
                                setShowEditAppointmentModal(true);
                              }}
                              className="text-blue-600 hover:text-blue-900 mr-4"
                              title="Editar cita"
                            >
                              <PencilIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedAppointmentForFinish(appointment);
                                setPaymentAmount(appointment.sessionCost || 0);
                                setShowFinishAppointmentModal(true);
                              }}
                              className="text-green-600 hover:text-green-900 mr-4"
                              title="Finalizar cita"
                            >
                              <CheckCircleIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(appointment)}
                              className="text-red-600 hover:text-red-900"
                              title="Eliminar cita"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          // ===== EMPTY STATE (sirve para mobile y desktop) =====
          <div className="text-center py-12">
            <CalendarIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay citas</h3>
            <p className="mt-1 text-sm text-gray-500">No tienes ninguna cita registrada.</p>
            <button
              onClick={() => setShowNewAppointmentModal(true)}
              className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Agendar Nueva Cita
            </button>
          </div>
        )}

      </div>

      {/* Modal para crear nueva cita */}
      {showNewAppointmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Nueva Cita</h2>
              <button
                onClick={() => setShowNewAppointmentModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              handleCreateAppointment({
                patientId: formData.get('patientId') as string,
                date: formData.get('date') as string,
                startTime: formData.get('startTime') as string,
                endTime: addMinutesToTime(formData.get('startTime') as string, Number(formData.get('duration') || 60)),
                type: formData.get('type') as 'regular' | 'first_time' | 'emergency',
                notes: formData.get('notes') as string,
                sessionCost: Number(formData.get('sessionCost'))
              });
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Paciente
                  </label>
                  {patients.length > 0 ? (
                    <select
                      name="patientId"
                      required
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="">Selecciona un paciente</option>
                      {patients.map(patient => (
                        <option key={patient.id} value={patient.id}>
                          {patient.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="mt-1 text-sm text-red-600">
                      No tienes pacientes activos asignados. Primero debes tener pacientes asignados para crear citas.
                    </p>
                  )}
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Fecha</label>
                    <input
                      type="date"
                      name="date"
                      required
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Hora de inicio</label>
                    <input
                      type="time"
                      name="startTime"
                      required
                      step={60}
                      min="06:00"
                      max="22:00"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Duración</label>
                    <select
                      name="duration"
                      defaultValue="60"
                      required
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="30">30 min</option>
                      <option value="45">45 min</option>
                      <option value="60">60 min</option>
                      <option value="90">90 min</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Tipo de Cita
                  </label>
                  <select
                    name="type"
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="regular">Regular</option>
                    <option value="first_time">Primera Vez</option>
                    <option value="emergency">Emergencia</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Costo de la Sesión
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <CurrencyDollarIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="number"
                      name="sessionCost"
                      required
                      min="0"
                      step="0.01"
                      className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Notas
                  </label>
                  <textarea
                    name="notes"
                    rows={3}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  ></textarea>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewAppointmentModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={patients.length === 0}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                    patients.length > 0 
                      ? 'bg-blue-600 hover:bg-blue-700' 
                      : 'bg-gray-400 cursor-not-allowed'
                  }`}
                >
                  Crear Cita
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para editar cita */}
      {showEditAppointmentModal && selectedAppointment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Editar Cita</h2>
              <button
                onClick={() => {
                  setShowEditAppointmentModal(false);
                  setSelectedAppointment(null);
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              handleEditAppointment({
                date: formData.get('date') as string,
                startTime: formData.get('startTime') as string,
                endTime: addMinutesToTime(formData.get('startTime') as string, Number(formData.get('duration') || 60)),
                type: formData.get('type') as 'regular' | 'first_time' | 'emergency',
                notes: formData.get('notes') as string,
                sessionCost: Number(formData.get('sessionCost'))
              });
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Paciente
                  </label>
                  <input
                    type="text"
                    value={selectedAppointment.patientName}
                    disabled
                    className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50 shadow-sm"
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Fecha</label>
                    <input
                      type="date"
                      name="date"
                      required
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Hora de inicio</label>
                    <input
                      type="time"
                      name="startTime"
                      required
                      step={60}
                      min="06:00"
                      max="22:00"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Duración</label>
                    <select
                      name="duration"
                      defaultValue="60"
                      required
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="30">30 min</option>
                      <option value="45">45 min</option>
                      <option value="60">60 min</option>
                      <option value="90">90 min</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Tipo de Cita
                  </label>
                  <select
                    name="type"
                    required
                    defaultValue={selectedAppointment.type}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="regular">Regular</option>
                    <option value="first_time">Primera Vez</option>
                    <option value="emergency">Emergencia</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Costo de la Sesión
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <CurrencyDollarIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="number"
                      name="sessionCost"
                      required
                      min="0"
                      step="0.01"
                      defaultValue={selectedAppointment.sessionCost}
                      className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Notas
                  </label>
                  <textarea
                    name="notes"
                    rows={3}
                    defaultValue={selectedAppointment.notes}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  ></textarea>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditAppointmentModal(false);
                    setSelectedAppointment(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para ver descripción */}
      {showDescriptionModal && selectedAppointmentForDescription && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Detalles de la Cita</h2>
              <button
                onClick={() => {
                  setShowDescriptionModal(false);
                  setSelectedAppointmentForDescription(null);
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Paciente</h3>
                <p className="mt-1 text-sm text-gray-900">{selectedAppointmentForDescription.patientName}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">Fecha y Hora</h3>
                <p className="mt-1 text-sm text-gray-900">
                  {combineLocalDateTime(
                      selectedAppointmentForDescription.date,
                      selectedAppointmentForDescription.startTime
                    ).toLocaleString('es-ES', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">Tipo de Cita</h3>
                <p className="mt-1 text-sm text-gray-900">
                  {selectedAppointmentForDescription.type === 'regular' ? 'Regular' : 
                   selectedAppointmentForDescription.type === 'first_time' ? 'Primera Vez' : 'Emergencia'}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">Precio de la Sesión</h3>
                <p className="mt-1 text-sm text-gray-900">
                  ${selectedAppointmentForDescription.sessionCost?.toFixed(2) || '0.00'}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">Notas</h3>
                <p className="mt-1 text-sm text-gray-900">
                  {selectedAppointmentForDescription.notes || 'Sin notas'}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">Estado</h3>
                <p className="mt-1">
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getAppointmentStatus(selectedAppointmentForDescription.date).class}`}>
                    {getAppointmentStatus(selectedAppointmentForDescription.date).label}
                  </span>
                </p>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setShowDescriptionModal(false);
                  setSelectedAppointmentForDescription(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para finalizar cita */}
      {showFinishAppointmentModal && selectedAppointmentForFinish && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Finalizar Cita</h2>
              <button
                onClick={() => {
                  setShowFinishAppointmentModal(false);
                  setSelectedAppointmentForFinish(null);
                  setPaymentAmount(0);
                  setAttended(true);
                  setRemainingBalance(0);
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Paciente
                </label>
                <p className="mt-1 text-sm text-gray-900">
                  {selectedAppointmentForFinish.patientName}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Fecha y Hora
                </label>
                <p className="mt-1 text-sm text-gray-900">
                  {combineLocalDateTime(
                      selectedAppointmentForFinish.date,
                      selectedAppointmentForFinish.startTime
                    ).toLocaleString('es-ES', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ¿El paciente asistió a la cita?
                </label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setAttended(true)}
                    className={`flex items-center px-4 py-2 rounded-lg ${
                      attended
                        ? 'bg-green-100 text-green-800 border-2 border-green-500'
                        : 'bg-gray-100 text-gray-800 border-2 border-transparent'
                    }`}
                  >
                    <CheckCircleIcon className="h-5 w-5 mr-2" />
                    Sí asistió
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttended(false)}
                    className={`flex items-center px-4 py-2 rounded-lg ${
                      !attended
                        ? 'bg-red-100 text-red-800 border-2 border-red-500'
                        : 'bg-gray-100 text-gray-800 border-2 border-transparent'
                    }`}
                  >
                    <XCircleIcon className="h-5 w-5 mr-2" />
                    No asistió
                  </button>
                </div>
              </div>

              {attended && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Costo de la sesión
                    </label>
                    <p className="mt-1 text-sm text-gray-900">
                      ${selectedAppointmentForFinish.sessionCost?.toFixed(2) || '0.00'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Monto pagado
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <CurrencyDollarIcon className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="number"
                        value={paymentAmount}
                        onChange={(e) => {
                          const paid = Number(e.target.value);
                          setPaymentAmount(paid);
                          const total = selectedAppointmentForFinish.sessionCost || 0;
                          setRemainingBalance(total - paid);
                        }}
                        className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Saldo pendiente
                    </label>
                    <p className={`mt-1 text-sm font-semibold ${
                      remainingBalance > 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      ${remainingBalance.toFixed(2)}
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowFinishAppointmentModal(false);
                  setSelectedAppointmentForFinish(null);
                  setPaymentAmount(0);
                  setAttended(true);
                  setRemainingBalance(0);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleFinishAppointment(selectedAppointmentForFinish.id, {
                  attended,
                  paymentAmount,
                  remainingBalance
                })}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Finalizar Cita
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para eliminar */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setAppointmentToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Eliminar Cita"
        message={
          appointmentToDelete
            ? `¿Estás seguro de que deseas eliminar la cita con ${
                appointmentToDelete.patientName
              } programada para el ${new Date(appointmentToDelete.date).toLocaleDateString(
                'es-ES',
                {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }
              )}?`
            : ''
        }
        confirmText="Eliminar"
        cancelText="Cancelar"
        type="danger"
      />
    </div>
  );
};

export default AppointmentsPage; 