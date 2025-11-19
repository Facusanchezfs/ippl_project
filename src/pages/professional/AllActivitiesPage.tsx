import { useState, useEffect } from 'react';
import { 
  ClockIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  BellIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';
import activityService from '../../services/activity.service';
import { useAuth } from '../../context/AuthContext';
import { getFriendlyErrorMessage, ErrorMessages } from '../../utils/errorMessages';
import type { Activity } from '../../types/Activity';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const AllActivitiesPage = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadActivities();
  }, []);

  const loadActivities = async () => {
    try {
      setIsLoading(true);
      const data = await activityService.getActivities();
      // Filtrar actividades relevantes para el profesional
      const filteredActivities = data.filter(activity => {
        // Solo mostrar actividades relacionadas con el profesional actual
        if (activity.metadata?.professionalId && activity.metadata.professionalId !== user?.id) {
          return false;
        }
        // Tipos de actividades a mostrar
        return [
          'FREQUENCY_CHANGE_APPROVED',
          'FREQUENCY_CHANGE_REJECTED',
          'STATUS_CHANGE_APPROVED',
          'STATUS_CHANGE_REJECTED'
        ].includes(activity.type);
      });
      setActivities(filteredActivities);
    } catch (error) {
      console.error('Error al cargar actividades:', error);
      const friendlyMessage = getFriendlyErrorMessage(error, 'No se pudieron cargar las actividades. Intenta recargar la página.');
      toast.error(friendlyMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'FREQUENCY_CHANGE_APPROVED':
        return <CheckCircleIcon className="h-6 w-6 text-green-500" />;
      case 'FREQUENCY_CHANGE_REJECTED':
        return <XCircleIcon className="h-6 w-6 text-red-500" />;
      case 'STATUS_CHANGE_APPROVED':
        return <CheckCircleIcon className="h-6 w-6 text-green-500" />;
      case 'STATUS_CHANGE_REJECTED':
        return <XCircleIcon className="h-6 w-6 text-red-500" />;
      default:
        return <BellIcon className="h-6 w-6 text-gray-500" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'FREQUENCY_CHANGE_APPROVED':
      case 'STATUS_CHANGE_APPROVED':
        return 'bg-green-100';
      case 'FREQUENCY_CHANGE_REJECTED':
      case 'STATUS_CHANGE_REJECTED':
        return 'bg-red-100';
      default:
        return 'bg-gray-100';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Función para traducir frecuencia
  const translateFrequency = (freq: string | undefined): string => {
    switch (freq) {
      case 'weekly': return 'Semanal';
      case 'biweekly': return 'Quincenal';
      case 'monthly': return 'Mensual';
      default: return freq || '';
    }
  };

  // Función para traducir descripción de actividad
  const translateDescription = (description: string, metadata?: Activity['metadata']): string => {
    let translated = description;
    
    // Reemplazar frecuencias en inglés
    translated = translated.replace(/\bweekly\b/gi, 'Semanal');
    translated = translated.replace(/\bbiweekly\b/gi, 'Quincenal');
    translated = translated.replace(/\bmonthly\b/gi, 'Mensual');
    
    // Reemplazar estados en inglés
    translated = translated.replace(/\bapproved\b/gi, 'Aprobado');
    translated = translated.replace(/\brejected\b/gi, 'Rechazado');
    translated = translated.replace(/\bpending\b/gi, 'Pendiente');
    translated = translated.replace(/\bactive\b/gi, 'Activo');
    translated = translated.replace(/\binactive\b/gi, 'Inactivo');
    
    // Si hay metadata con newFrequency, currentFrequency, etc., traducirlos también
    if (metadata?.newFrequency) {
      translated = translated.replace(
        metadata.newFrequency as string,
        translateFrequency(metadata.newFrequency as string)
      );
    }
    if (metadata?.currentFrequency) {
      translated = translated.replace(
        metadata.currentFrequency as string,
        translateFrequency(metadata.currentFrequency as string)
      );
    }
    if (metadata?.requestedFrequency) {
      translated = translated.replace(
        metadata.requestedFrequency as string,
        translateFrequency(metadata.requestedFrequency as string)
      );
    }
    
    return translated;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/professional')}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              Volver al Dashboard
            </button>
            <h1 className="text-2xl font-bold text-gray-900">
              Historial de Actividades
            </h1>
          </div>
          <button
            onClick={loadActivities}
            className="flex items-center px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <ClockIcon className="h-5 w-5 mr-2" />
            Actualizar
          </button>
        </div>

        {activities.length === 0 ? (
          <div className="text-center py-12">
            <BellIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay actividades registradas</h3>
            <p className="mt-1 text-sm text-gray-500">
              Las notificaciones sobre cambios de estado y frecuencia aparecerán aquí.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div
                key={activity._id}
                className={`flex items-start space-x-4 p-4 rounded-lg ${getActivityColor(activity.type)}`}
              >
                <div className="flex-shrink-0">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {activity.title}
                  </p>
                  <p className="text-sm text-gray-500">
                    {translateDescription(activity.description, activity.metadata)}
                  </p>
                  {activity.metadata?.adminResponse && (
                    <p className="mt-1 text-sm text-gray-600 italic">
                      Respuesta: {activity.metadata.adminResponse}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-400">
                    {formatDate(activity.date)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AllActivitiesPage; 