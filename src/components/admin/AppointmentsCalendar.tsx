import { useState, useEffect, useCallback } from 'react';
import { Calendar, momentLocalizer, View } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/es';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useAuth } from '../../context/AuthContext';
import appointmentsService from '../../services/appointments.service';
import { Appointment } from '../../types/Appointment';
import { ArrowLeftIcon, ClockIcon, UserIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getFriendlyErrorMessage, ErrorMessages } from '../../utils/errorMessages';

// Configurar moment en español de forma robusta
moment.locale('es', {
  weekdays: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
  weekdaysShort: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
  weekdaysMin: ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'],
  months: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
  monthsShort: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
});

// Crear localizador con configuración específica para español
const localizer = momentLocalizer(moment);

// Función para obtener el color según el tipo de cita
const getAppointmentColor = (type: string) => {
  switch (type) {
    case 'regular':
      return 'bg-blue-100 border-blue-200 text-blue-800';
    case 'first_time':
      return 'bg-green-100 border-green-200 text-green-800';
    case 'emergency':
      return 'bg-red-100 border-red-200 text-red-800';
    default:
      return 'bg-gray-100 border-gray-200 text-gray-800';
  }
};

// Componente personalizado para el evento en el calendario
const EventComponent = ({ event }: any) => {
  const appointment = event.resource;
  const colorClass = getAppointmentColor(appointment.type);
  
  return (
    <div className={`p-1 rounded-lg border ${colorClass} overflow-hidden h-full`}>
      <div className="font-medium text-sm truncate">
        {appointment.patientName}
      </div>
      <div className="text-xs flex items-center gap-1">
        <ClockIcon className="h-3 w-3" />
        {moment(event.start).format('HH:mm')}–{moment(event.end).format('HH:mm')}
      </div>
      <div className="text-xs">
        {appointment.type === 'regular'
          ? 'Regular'
          : appointment.type === 'first_time'
          ? 'Primera Vez'
          : 'Emergencia'}
      </div>
    </div>
  );
};

const AppointmentsCalendar = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [view, setView] = useState<View>('week');
  const navigate = useNavigate();

  const loadAppointments = useCallback(async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      const data = await appointmentsService.getProfessionalAppointments(user.id);
      
      // Convertir las citas al formato que espera el calendario
      const formattedAppointments = data.map(appointment => {
        const start = toLocalDate(appointment.date, appointment.startTime);
        let end   = toLocalDate(appointment.date, appointment.endTime);

        // Garantizar end > start (y evitar "doble día" por igualdades)
        if (end <= start) {
          end = new Date(start.getTime() + 30 * 60 * 1000); // +30 min de respaldo
        }
        
        return {
        id: appointment.id,
        title: appointment.patientName,
        start,
        end,
        resource: appointment
      }});
      
      setAppointments(formattedAppointments);
    } catch (error) {
      console.error('Error al cargar las citas:', error);
      const friendlyMessage = getFriendlyErrorMessage(error, ErrorMessages.APPOINTMENT_LOAD_FAILED);
      toast.error(friendlyMessage);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const toLocalDate = (dateStr: string, timeStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm]   = timeStr.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0); // <-- local time
}

  const handleSelectEvent = (event: any) => {
    setSelectedAppointment(event.resource);
  };

  // Personalizar la barra de herramientas del calendario (responsive)
  const CustomToolbar = (toolbar: any) => {
    const goToBack = () => toolbar.onNavigate('PREV');
    const goToNext = () => toolbar.onNavigate('NEXT');
    const goToCurrent = () => toolbar.onNavigate('TODAY');

    return (
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 mb-4 p-2 bg-gray-50 rounded-lg">
        {/* Navegación + label */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={goToBack}
              className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-200 rounded"
              aria-label="Anterior"
            >
              ←
            </button>
            <button
              onClick={goToCurrent}
              className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-200 rounded"
            >
              Hoy
            </button>
            <button
              onClick={goToNext}
              className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-200 rounded"
              aria-label="Siguiente"
            >
              →
            </button>
          </div>

          {/* Label centrado y truncado en mobile */}
          <span className="text-base md:text-lg font-semibold ml-2 md:ml-4 truncate max-w-[60vw] md:max-w-none text-center md:text-left">
            {toolbar.label}
          </span>
        </div>

        {/* Selección de vista */}
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <button
            onClick={() => toolbar.onView('month')}
            className={`px-3 py-1 text-sm rounded ${
              view === 'month' ? 'bg-blue-100 text-blue-800' : 'text-gray-600 hover:bg-gray-200'
            }`}
          >
            Mes
          </button>
          <button
            onClick={() => toolbar.onView('week')}
            className={`px-3 py-1 text-sm rounded ${
              view === 'week' ? 'bg-blue-100 text-blue-800' : 'text-gray-600 hover:bg-gray-200'
            }`}
          >
            Semana
          </button>
          <button
            onClick={() => toolbar.onView('day')}
            className={`px-3 py-1 text-sm rounded ${
              view === 'day' ? 'bg-blue-100 text-blue-800' : 'text-gray-600 hover:bg-gray-200'
            }`}
          >
            Día
          </button>
          <button
            onClick={() => toolbar.onView('agenda')}
            className={`px-3 py-1 text-sm rounded ${
              view === 'agenda' ? 'bg-blue-100 text-blue-800' : 'text-gray-600 hover:bg-gray-200'
            }`}
          >
            Agenda
          </button>
        </div>
      </div>
    );
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
      {/* Header responsive */}
      <div className="mb-6 flex flex-col md:flex-row md:justify-between md:items-center gap-3">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <button
            onClick={() => navigate(user?.role === 'admin' ? '/admin' : '/professional')}
            className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Volver al Dashboard
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Calendario de Citas</h1>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 md:p-6">
      {/* Leyenda responsive */}
        <div className="mb-4 flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-100 border border-blue-200"></div>
            <span className="text-sm text-gray-600">Regular</span>
          </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-100 border border-green-200"></div>
          <span className="text-sm text-gray-600">Primera Vez</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-100 border border-red-200"></div>
          <span className="text-sm text-gray-600">Emergencia</span>
        </div>
      </div>

        <div className="h-[60vh] md:h-[calc(100vh-250px)]">
          <Calendar
            localizer={localizer}
            events={appointments}
            startAccessor="start"
            endAccessor="end"
            style={{ height: '100%' }}
            onSelectEvent={handleSelectEvent}
            components={{ event: EventComponent, toolbar: CustomToolbar }}
            onView={(newView) => setView(newView)}
            view={view}
            culture="es"
            formats={{
              dayFormat: (date: Date) => moment(date).format('dddd'),
              weekdayFormat: (date: Date) => moment(date).format('dddd'),
              dayHeaderFormat: (date: Date) => moment(date).format('dddd'),
              dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) => 
                moment(start).format('dddd') + ' - ' + moment(end).format('dddd'),
              monthHeaderFormat: (date: Date) => moment(date).format('MMMM YYYY'),
              timeGutterFormat: (date: Date) => moment(date).format('HH:mm')
            }}
            messages={{
              next: "Siguiente",
              previous: "Anterior",
              today: "Hoy",
              month: "Mes",
              week: "Semana",
              day: "Día",
              agenda: "Agenda",
              date: "Fecha",
              time: "Hora",
              event: "Evento",
              noEventsInRange: "No hay citas en este rango de fechas."
            }}
          />
        </div>
      </div>

      {/* Modal para ver detalles de la cita */}
      {selectedAppointment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Detalles de la Cita</h2>
              <button
                onClick={() => setSelectedAppointment(null)}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <UserIcon className="h-5 w-5 text-gray-400" />
                <div>
                  <label className="block text-sm font-medium text-gray-700">Paciente</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedAppointment.patientName}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <ClockIcon className="h-5 w-5 text-gray-400" />
                <div>
                  <label className="block text-sm font-medium text-gray-700">Fecha y Hora</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {moment(selectedAppointment.date).format('LLLL')}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className={`h-5 w-5 rounded-full ${getAppointmentColor(selectedAppointment.type)}`} />
                <div>
                  <label className="block text-sm font-medium text-gray-700">Tipo de Cita</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {selectedAppointment.type === 'regular' ? 'Regular' : 
                     selectedAppointment.type === 'first_time' ? 'Primera Vez' : 'Emergencia'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <CurrencyDollarIcon className="h-5 w-5 text-gray-400" />
                <div>
                  <label className="block text-sm font-medium text-gray-700">Costo</label>
                  <p className="mt-1 text-sm text-gray-900">
                    ${selectedAppointment.sessionCost?.toFixed(2) ?? '0.00'}
                  </p>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Estado</label>
                <span className={`mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  selectedAppointment.status === 'completed' ? 'bg-green-100 text-green-800' :
                  selectedAppointment.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {selectedAppointment.status === 'completed' ? 'Completada' :
                   selectedAppointment.status === 'cancelled' ? 'Cancelada' :
                   'Pendiente'}
                </span>
              </div>
              
              {selectedAppointment.notes && (
                <div className="border-t pt-4 mt-4">
                  <label className="block text-sm font-medium text-gray-700">Notas</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedAppointment.notes}</p>
                </div>
              )}
            </div>
            
            <div className="mt-6">
              <button
                onClick={() => setSelectedAppointment(null)}
                className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentsCalendar; 