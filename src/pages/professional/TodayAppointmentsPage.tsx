import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import appointmentsService from '../../services/appointments.service';
import appointmentCancellationRequestService from '../../services/appointmentCancellationRequest.service';
import { Appointment, AppointmentStatus } from '../../types/Appointment';
import {
  CalendarIcon,
  ClockIcon,
  UserIcon,
  ArrowPathIcon,
  ArrowLeftIcon,
  CurrencyDollarIcon,
  PencilIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  EyeIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const AppointmentsPage = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showEditAppointmentModal, setShowEditAppointmentModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'upcoming' | 'past'>('all');
  const [cancelFilter, setCancelFilter] = useState<'exclude' | 'include' | 'only'>('exclude');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);
  const [selectedAppointmentForDescription, setSelectedAppointmentForDescription] = useState<Appointment | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isSubmittingCancellation, setIsSubmittingCancellation] = useState(false);
  const [pendingCancellationIds, setPendingCancellationIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  const navigate = useNavigate();

  useEffect(() => {
    void loadAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Cuando cambian los filtros, volvemos a la primera página para que
  // el paginado coincida con el dataset filtrado (evita "parece que no cambia").
  useEffect(() => {
    setPage(1);
  }, [filterStatus, cancelFilter, sortOrder]);

  const loadAppointments = async () => {
    if (!user) return;
  
    try {
      setIsLoading(true);
  
      const data = await appointmentsService.getProfessionalAppointments(
        user.id,
        undefined,
        undefined,
        'all',
        'include'
      );
  
      setAppointments(data.appointments);
  
    } catch (error) {
      console.error("Error al cargar las citas:", error);
      toast.error("Error al cargar citas");
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
    return new Date(y, (m - 1), d, hh, mm);
  }

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
    switch (status) {
      case AppointmentStatus.scheduled:
        return { label: 'Pendiente', class: 'bg-yellow-100 text-yellow-800' }
      case AppointmentStatus.completed:
        return { label: 'Finalizada', class: 'bg-gray-100 text-gray-800' }
      case AppointmentStatus.cancelled:
        return { label: 'Cancelada', class: 'bg-red-100 text-red-800' }
      default:
        return { label: '', class: '' };
    }
  };


  const handleEditAppointment = async (appointmentData: { sessionCost: number }) => {
    try {
      if (!selectedAppointment) return;

      await appointmentsService.updateAppointment(selectedAppointment.id, {
        sessionCost: appointmentData.sessionCost,
      });

      await loadAppointments();
      setShowEditAppointmentModal(false);
      setSelectedAppointment(null);
      toast.success('Monto de la sesión actualizado exitosamente');
    } catch (error) {
      console.error('Error al actualizar el monto de la cita:', error);
      // Log temporal: ayuda a distinguir si falla por validación del backend (Joi),
      // por regla de negocio (403) u otro motivo.
      console.log(
        '[EditAppointment] error payload:',
        (error as any)?.response?.data
      );
      toast.error('Error al actualizar el monto de la cita');
    }
  };

  // Blindaje UI: aunque el backend aplique `cancelFilter`, si por algún motivo
  // llega información que no coincide (p.ej. request previo en caché / validación),
  // garantizamos que "Ocultar canceladas" realmente no las muestre.
  const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD (UTC)
  const nowTime = new Date().toTimeString().slice(0, 5); // HH:mm (local)
  const filteredAppointments = appointments
    .filter((appointment) => {
      if (filterStatus === 'upcoming') {
        return (
          appointment.status === 'scheduled' &&
          (appointment.date > todayStr ||
            (appointment.date === todayStr &&
              (appointment.startTime || '') >= nowTime))
        );
      }

      if (filterStatus === 'past') {
        return (
          appointment.date < todayStr ||
          (appointment.date === todayStr &&
            (appointment.startTime || '') < nowTime) ||
          // Past incluye todo lo que no es 'scheduled' (cancelled/completed).
          appointment.status !== 'scheduled'
        );
      }

      return true; // all
    })
    .filter((appointment) => {
      if (cancelFilter === 'exclude') return appointment.status !== 'cancelled';
      if (cancelFilter === 'only') return appointment.status === 'cancelled';
      return true; // include
    })
    .sort((a, b) => {
      const dateA = combineLocalDateTime(a.date, a.startTime).getTime();
      const dateB = combineLocalDateTime(b.date, b.startTime).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

  const clientLimit = 20;
  const totalFiltered = filteredAppointments.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / clientLimit));
  const currentPage = Math.min(page, totalPages);
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;
  const paginatedAppointments = filteredAppointments.slice(
    (currentPage - 1) * clientLimit,
    currentPage * clientLimit
  );



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
              onClick={handleRefresh}
              className={`flex items-center px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors ${isRefreshing ? 'opacity-50 cursor-not-allowed' : ''
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
              onChange={(e) =>
                setFilterStatus(e.target.value as 'all' | 'upcoming' | 'past')
              }
              className="rounded-lg border-gray-300 text-sm"
            >
              <option value="all">Todas las citas</option>
              <option value="upcoming">Citas próximas</option>
              <option value="past">Citas pasadas</option>
            </select>
            <select
              value={cancelFilter}
              onChange={(e) =>
                setCancelFilter(
                  e.target.value as 'exclude' | 'include' | 'only'
                )
              }
              className="rounded-lg border-gray-300 text-sm"
            >
              <option value="exclude">Ocultar canceladas</option>
              <option value="include">Incluir canceladas</option>
              <option value="only">Solo canceladas</option>
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
              {paginatedAppointments.map((appointment) => {
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
                      {pendingCancellationIds.has(appointment.id) && appointment.status === 'scheduled' && (
                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-orange-800">
                          Cancelación solicitada
                        </span>
                      )}
                      <span className="text-xs rounded px-2 py-1 bg-gray-100 text-gray-700">
                        {appointment.frequencyLabel ?? 'One-time'}
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

                      {appointment.status !== 'completed' &&
                        appointment.status !== 'cancelled' && (
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
                        )}
                      {appointment.status === 'scheduled' && (
                        <button
                          onClick={() => {
                            setAppointmentToCancel(appointment);
                            setCancelReason('');
                            setShowCancelModal(true);
                          }}
                          className="text-orange-600 hover:text-orange-800 inline-flex items-center text-sm font-medium"
                          title="Solicitar cancelación"
                        >
                          Solicitar cancelación
                        </button>
                      )}
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
                        Frecuencia
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
                    {paginatedAppointments.map((appointment) => {
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
                            <div className="flex flex-col gap-1">
                              <span
                                className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${status.class}`}
                              >
                                {status.label}
                              </span>
                              {pendingCancellationIds.has(appointment.id) && appointment.status === 'scheduled' && (
                                <span className="px-2 py-0.5 inline-flex text-xs leading-4 font-medium rounded-full bg-orange-100 text-orange-800">
                                  Cancelación solicitada
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {appointment.frequencyLabel ?? 'One-time'}
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
                            {appointment.status !== 'completed' &&
                              appointment.status !== 'cancelled' && (
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
                              )}
                            {appointment.status === 'scheduled' && (
                              <button
                                onClick={() => {
                                  setAppointmentToCancel(appointment);
                                  setCancelReason('');
                                  setShowCancelModal(true);
                                }}
                                className="text-orange-600 hover:text-orange-800 text-sm font-medium"
                                title="Solicitar cancelación"
                              >
                                Solicitar cancelación
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {totalPages > 1 && (
                  <div className="flex justify-between items-center mt-6">

                    {/* Prev */}
                    <button
                      disabled={!hasPrev}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className={`px-4 py-2 rounded-lg text-sm font-medium
                        ${hasPrev
                          ? "bg-gray-100 hover:bg-gray-200 text-gray-800"
                          : "bg-gray-50 text-gray-400 cursor-not-allowed"
                        }`}
                    >
                      ◀ Página anterior
                    </button>

                    {/* Info */}
                    <span className="text-sm text-gray-600">
                      Página {currentPage} de {totalPages}
                    </span>

                    {/* Next */}
                    <button
                      disabled={!hasNext}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className={`px-4 py-2 rounded-lg text-sm font-medium
                        ${hasNext
                          ? "bg-gray-100 hover:bg-gray-200 text-gray-800"
                          : "bg-gray-50 text-gray-400 cursor-not-allowed"
                        }`}
                    >
                      Página siguiente ▶
                    </button>
                  </div>
                )}

              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <CalendarIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay citas</h3>
            <p className="mt-1 text-sm text-gray-500">No tienes ninguna cita registrada.</p>
          </div>
        )}

      </div>


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

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const raw = formData.get('sessionCost');
                // Soporte básico de coma decimal (p.ej. "12,34") para que Joi.number() no falle.
                const normalized = typeof raw === 'string' ? raw.replace(',', '.') : String(raw ?? '0');
                const sessionCost = Number(normalized);

                console.log('[EditAppointment] sessionCost raw:', raw, 'normalized:', normalized, 'parsed:', sessionCost);

                if (!Number.isFinite(sessionCost) || sessionCost < 0) {
                  toast.error('Monto inválido');
                  return;
                }

                handleEditAppointment({ sessionCost });
              }}
            >
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

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Fecha y hora
                  </label>
                  <p className="text-sm text-gray-900">
                    {formatDateTime(selectedAppointment.date, selectedAppointment.startTime)}
                  </p>
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
                      defaultValue={selectedAppointment.sessionCost}
                    />
                  </div>
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
                <h3 className="text-sm font-medium text-gray-500">Frecuencia de la Cita</h3>
                <p className="mt-1 text-sm text-gray-900">
                  {selectedAppointmentForDescription.frequencyLabel ?? 'One-time'}
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

      {/* Modal para solicitar cancelación de cita */}
      {showCancelModal && appointmentToCancel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Solicitar cancelación de cita</h2>
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setAppointmentToCancel(null);
                  setCancelReason('');
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Estás solicitando la cancelación de la cita con{' '}
              <span className="font-medium">{appointmentToCancel.patientName}</span> el{' '}
              {formatDateTime(appointmentToCancel.date, appointmentToCancel.startTime)}.
            </p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const trimmed = cancelReason.trim();
                if (!trimmed) {
                  toast.error('El motivo de cancelación es obligatorio');
                  return;
                }
                if (trimmed.length > 1000) {
                  toast.error('El motivo de cancelación no puede superar los 1000 caracteres');
                  return;
                }

                try {
                  setIsSubmittingCancellation(true);
                  await appointmentCancellationRequestService.create(
                    appointmentToCancel.id,
                    trimmed
                  );

                  // Agregar al estado local para mostrar el badge
                  setPendingCancellationIds((prev) => {
                    const next = new Set(prev);
                    next.add(appointmentToCancel.id);
                    return next;
                  });

                  setShowCancelModal(false);
                  setAppointmentToCancel(null);
                  setCancelReason('');
                  toast.success('Solicitud de cancelación enviada al administrador');
                } catch (error: any) {
                  const status = error?.response?.status;
                  const backendData = error?.response?.data;
                  const backendMsg = backendData?.error;
                  const backendDetails = backendData?.details;

                  console.error('Error al crear solicitud de cancelación:', {
                    status,
                    backendData,
                    backendMsg,
                    backendDetails,
                    requestPayload: {
                      appointmentId: appointmentToCancel.id,
                      reasonLength: trimmed.length,
                    },
                  });
                  toast.error(
                    backendMsg || 'Error al enviar la solicitud de cancelación'
                  );
                } finally {
                  setIsSubmittingCancellation(false);
                }
              }}
            >
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motivo de cancelación
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  maxLength={1000}
                  disabled={isSubmittingCancellation}
                />
                <p className="mt-1 text-xs text-gray-400">
                  {cancelReason.length} / 1000 caracteres
                </p>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCancelModal(false);
                    setAppointmentToCancel(null);
                    setCancelReason('');
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  disabled={isSubmittingCancellation}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  disabled={isSubmittingCancellation}
                >
                  {isSubmittingCancellation ? 'Enviando...' : 'Enviar solicitud'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentsPage; 