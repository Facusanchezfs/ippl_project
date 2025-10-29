import React, { useState, useEffect } from 'react';
import { 
  ClockIcon, 
  UserIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  BellIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import activityService from '../../services/activity.service';
import { getFriendlyErrorMessage } from '../../utils/errorMessages';
import type { Activity } from '../../types/Activity';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const MAX_ACTIVITIES = 4;

const RecentActivityProfessional = () => {
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
      }).slice(0, MAX_ACTIVITIES); // Limitar a 4 actividades
      setActivities(filteredActivities);
    } catch (error) {
      console.error('Error al cargar actividades:', error);
      const friendlyMessage = getFriendlyErrorMessage(error, 'No se pudieron cargar las actividades recientes. Intenta recargar la página.');
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Actividad Reciente</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={loadActivities}
            className="text-blue-600 hover:text-blue-800"
            title="Actualizar"
          >
            <ClockIcon className="h-5 w-5" />
          </button>
          <button
            onClick={() => navigate('/professional/actividades')}
            className="flex items-center text-sm text-blue-600 hover:text-blue-800"
          >
            Ver todas
            <ArrowRightIcon className="h-4 w-4 ml-1" />
          </button>
        </div>
      </div>

      {activities.length === 0 ? (
        <div className="text-center py-12">
          <BellIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No hay actividades recientes</h3>
          <p className="mt-1 text-sm text-gray-500">
            Las notificaciones sobre cambios de estado y frecuencia aparecerán aquí.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {activities.map((activity) => (
            <div
              key={`${activity.type}-${activity.date}`}
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
                  {activity.description}
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
  );
};

export default RecentActivityProfessional; 