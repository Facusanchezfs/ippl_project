import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import appointmentsService from '../../services/appointments.service';
import { Appointment } from '../../types/Appointment';
import { getFriendlyErrorMessage, ErrorMessages } from '../../utils/errorMessages';
import { 
  CalendarIcon, 
  ClockIcon,
  UserIcon,
  ArrowPathIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { formatAppointmentDateTimeEsAR } from '../../utils/appointmentDateTime';

const CompletedAppointmentsPage = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [frequencyFilter, setFrequencyFilter] = useState("todos");
  const [attendedFilter, setAttendedFilter] = useState("todos");

  useEffect(() => {
    loadAppointments();
  }, [user]);

  const loadAppointments = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      const completedAppointments = await appointmentsService.getCompletedAppointments(user.id);
      setAppointments(completedAppointments);
    } catch (error) {
      console.error('Error al cargar las citas:', error);
      const friendlyMessage = getFriendlyErrorMessage(error, ErrorMessages.APPOINTMENT_LOAD_FAILED);
      toast.error(friendlyMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadAppointments();
    setIsRefreshing(false);
    toast.success('Datos actualizados');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const filteredAppointments = appointments
  .filter(a => a.patientName.toLowerCase().includes(search.toLowerCase()))
  .filter(a => frequencyFilter === "todos" || a.frequencyLabel === frequencyFilter)
  .filter(a => attendedFilter === "todos" || (attendedFilter === "si" ? a.attended : !a.attended));

const formatDate = (date: string, startTime?: string) =>
  formatAppointmentDateTimeEsAR(date, startTime);

const badge = (ok?: boolean) =>
  `px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
    ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
  }`;

  const formatPago = (a: Appointment) => {
    // En la respuesta del backend el valor viene como `sessionCost`
    // (y a veces `remainingBalance`). `paymentAmount` parece no estar seteado.
    const value = a.sessionCost ?? a.remainingBalance ?? a.paymentAmount ?? 0;
    return value.toFixed(2);
  };

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-3">
          {/* Bloque izquierda */}
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <button
              onClick={() => navigate('/professional')}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              Volver al Dashboard
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Citas Finalizadas</h1>
          </div>

          {/* Bloque derecha */}
          <div className="flex items-center gap-3 md:justify-end">
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


        {appointments.length > 0 ? (
          <>
            <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <input
                type="text"
                placeholder="Buscar por paciente..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 md:w-64"
              />
              <div className="flex gap-2 flex-wrap">
                <select
                  value={frequencyFilter}
                  onChange={e => setFrequencyFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="todos">Todas las frecuencias</option>
                  {/* Valores alineados con `frequencyLabel` del backend (AppointmentDTO) */}
                  <option value="Semanal">Semanal</option>
                  <option value="Quincenal">Quincenal</option>
                  <option value="Mensual">Mensual</option>
                  <option value="Dos veces por semana">Dos veces por semana</option>
                </select>
                <select
                  value={attendedFilter}
                  onChange={e => setAttendedFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="todos">Asistieron y no asistieron</option>
                  <option value="si">Sí asistió</option>
                  <option value="no">No asistió</option>
                </select>
              </div>
            </div>
          {/* Tabla: visible en desktop */}
            <div className="hidden md:block">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paciente</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha y Hora</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Frecuencia</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asistió</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pago</th>
                      {/* Ya no se muestran acciones (eliminar) */}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredAppointments.map((appointment) => (
                      <tr key={appointment.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <UserIcon className="h-6 w-6 text-gray-400" />
                            <div className="ml-4 text-sm font-medium text-gray-900">
                              {appointment.patientName}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <ClockIcon className="h-5 w-5 text-gray-400 mr-2" />
                            <span className="text-sm text-gray-900">
                              {formatDate(appointment.date, appointment.startTime)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {appointment.frequencyLabel ?? 'One-time'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">  
                          <span className={badge(appointment.attended)}>
                            {appointment.attended ? 'Sí' : 'No'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${formatPago(appointment)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          {/* Cards: visible en mobile/tablet */}
            <div className="block md:hidden space-y-3">
              {filteredAppointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <UserIcon className="h-6 w-6 text-gray-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-semibold text-gray-900 truncate">
                        {appointment.patientName}
                      </h3>
                      <div className="mt-1 flex items-center text-sm text-gray-600">
                        <ClockIcon className="h-4 w-4 mr-1 shrink-0" />
                        <span className="truncate">
                          {formatDate(appointment.date, appointment.startTime)}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-xs rounded px-2 py-1 bg-gray-100 text-gray-700">
                          {appointment.frequencyLabel ?? 'One-time'}
                        </span>
                        <span className={badge(appointment.attended)}>
                          {appointment.attended ? 'Asistió: Sí' : 'Asistió: No'}
                        </span>
                      </div>

                      <div className="mt-3 rounded bg-gray-50 p-2 text-sm">
                        <div className="text-gray-500">Pago</div>
                        <div className="font-medium text-gray-900">
                          ${formatPago(appointment)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <CalendarIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay citas finalizadas</h3>
            <p className="mt-1 text-sm text-gray-500">
              No tienes ninguna cita finalizada registrada.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompletedAppointmentsPage;