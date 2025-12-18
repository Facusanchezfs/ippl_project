import React, { useState, useEffect } from 'react';
import { Activity } from '../types/Activity';
import activityService from '../services/activity.service';
import { BellIcon, CheckCircleIcon, ArrowLeftIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import ConfirmationModal from '../components/common/ConfirmationModal';
import { useAuth } from '../context/AuthContext';
import frequencyRequestService from '../services/frequencyRequest.service';
import statusRequestService from '../services/statusRequest.service';

const RELEVANT_ACTIVITY_TYPES: Activity['type'][] = [
  'PATIENT_DISCHARGE_REQUEST',
  'PATIENT_ACTIVATION_REQUEST',
  'STATUS_CHANGE_APPROVED',
  'STATUS_CHANGE_REJECTED',
  'FREQUENCY_CHANGE_REQUEST',
  'FREQUENCY_CHANGE_REQUESTED',
  'FREQUENCY_CHANGE_APPROVED',
  'FREQUENCY_CHANGE_REJECTED'
];

const translateFrequency = (freq?: string) => {
  switch (freq) {
    case 'weekly':
      return 'Semanal';
    case 'biweekly':
      return 'Quincenal';
    case 'monthly':
      return 'Mensual';
    default:
      return freq || '';
  }
};

const translateActivity = (activity: Activity): Activity => {
  if (activity.type.startsWith('FREQUENCY_CHANGE')) {
    const professionalName = activity.metadata?.professionalName || 'Un profesional';
    const patientName = activity.metadata?.patientName || 'un paciente';
    const currentFrequency = translateFrequency(activity.metadata?.currentFrequency as string);
    const requestedFrequency = translateFrequency((activity.metadata?.requestedFrequency as string) || (activity.metadata?.newFrequency as string));

    if (activity.type === 'FREQUENCY_CHANGE_REQUEST' || activity.type === 'FREQUENCY_CHANGE_REQUESTED') {
      // Si falta información de frecuencia, mostrar un mensaje más claro
      if (!currentFrequency && !requestedFrequency) {
        return {
          ...activity,
          title: 'Solicitud de cambio de frecuencia',
          description: `${professionalName} solicitó cambiar la frecuencia de sesiones de ${patientName}`,
        };
      }
      if (!currentFrequency) {
        return {
          ...activity,
          title: 'Solicitud de cambio de frecuencia',
          description: `${professionalName} solicitó cambiar la frecuencia de sesiones de ${patientName} a ${requestedFrequency}`,
        };
      }
      if (!requestedFrequency) {
        return {
          ...activity,
          title: 'Solicitud de cambio de frecuencia',
          description: `${professionalName} solicitó cambiar la frecuencia de sesiones de ${patientName} desde ${currentFrequency}`,
        };
      }
      return {
        ...activity,
        title: 'Solicitud de cambio de frecuencia',
        description: `${professionalName} solicitó cambiar la frecuencia de sesiones de ${patientName} de ${currentFrequency} a ${requestedFrequency}`,
      };
    }

    const actionText = activity.type === 'FREQUENCY_CHANGE_APPROVED' ? 'aprobó' : 'rechazó';
    return {
      ...activity,
      title: `Solicitud de cambio de frecuencia ${actionText}`,
      description: `Se ${actionText} el cambio de frecuencia para ${patientName}${requestedFrequency ? ` a ${requestedFrequency}` : ''}`,
    };
  }

  return activity;
};

const ActivityPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [disabledActivities, setDisabledActivities] = useState<Record<string, boolean>>({});

  const filteredActivities = activities.filter(activity =>
    RELEVANT_ACTIVITY_TYPES.includes(activity.type)
  );

  const handleActivityClick = async (activity: Activity): Promise<void> => {
    if (activity.type === 'FREQUENCY_CHANGE_REQUEST' || activity.type === 'FREQUENCY_CHANGE_REQUESTED') {
      const activityId = activity._id;
      if (disabledActivities[activityId]) return;
      setDisabledActivities(prev => ({ ...prev, [activityId]: true }));

      const patientId = activity.metadata?.patientId ? String(activity.metadata.patientId) : null;
      if (!patientId) {
        toast.error('No se encontró información del paciente para esta solicitud. Por favor, contacte al administrador.');
        setDisabledActivities(prev => ({ ...prev, [activityId]: false }));
        return;
      }

      try {
        const requests = await frequencyRequestService.getPendingRequests();
        const pendingRequest = requests.find((r) => String(r.patientId) === String(patientId));

        if (!pendingRequest) {
          toast.error('La solicitud ya fue resuelta');
          // Asegurar que el estado se mantenga como deshabilitado
          setDisabledActivities(prev => ({ ...prev, [activityId]: true }));
          return;
        }

        setActivities(prev => prev.filter(a => a._id !== activity._id));
        try {
          await activityService.markAsRead(activity._id);
        } catch (error) {
          console.error('Error al marcar actividad como leída:', error);
        }

        navigate('/admin/pacientes', {
          state: {
            from: 'activities',
            openFrequencyRequest: {
              patientId: String(patientId),
              requestId: pendingRequest.id,
            },
          },
        });
      } catch (error) {
        console.error('Error al validar solicitud:', error);
        toast.error('No se pudo validar la solicitud');
        setDisabledActivities(prev => ({ ...prev, [activity._id]: false }));
      }
    } else if (activity.type === 'PATIENT_DISCHARGE_REQUEST') {
      const activityId = activity._id;
      if (disabledActivities[activityId]) return;
      setDisabledActivities(prev => ({ ...prev, [activityId]: true }));

      const patientId = activity.metadata?.patientId ? String(activity.metadata.patientId) : null;
      if (!patientId) {
        toast.error('No se encontró información del paciente para esta solicitud. Por favor, contacte al administrador.');
        setDisabledActivities(prev => ({ ...prev, [activityId]: false }));
        return;
      }

      try {
        const requests = await statusRequestService.getPendingRequests();
        const pendingRequest = requests.find((r) => 
          String(r.patientId) === String(patientId) && 
          r.requestedStatus === 'inactive' && 
          r.type !== 'activation'
        );

        if (!pendingRequest) {
          toast.error('La solicitud ya fue resuelta');
          setDisabledActivities(prev => ({ ...prev, [activityId]: true }));
          return;
        }

        setActivities(prev => prev.filter(a => a._id !== activity._id));
        try {
          await activityService.markAsRead(activity._id);
        } catch (error) {
          console.error('Error al marcar actividad como leída:', error);
        }

        navigate('/admin/pacientes', {
          state: {
            from: 'activities',
            openStatusRequest: {
              patientId: String(patientId),
              requestId: pendingRequest.id,
            },
          },
        });
      } catch (error) {
        console.error('Error al validar solicitud:', error);
        toast.error('No se pudo validar la solicitud');
        setDisabledActivities(prev => ({ ...prev, [activity._id]: false }));
      }
    } else if (activity.type === 'PATIENT_ACTIVATION_REQUEST') {
      const activityId = activity._id;
      if (disabledActivities[activityId]) return;
      setDisabledActivities(prev => ({ ...prev, [activityId]: true }));

      const patientId = activity.metadata?.patientId ? String(activity.metadata.patientId) : null;
      if (!patientId) {
        toast.error('No se encontró información del paciente para esta solicitud. Por favor, contacte al administrador.');
        setDisabledActivities(prev => ({ ...prev, [activityId]: false }));
        return;
      }

      try {
        const requests = await statusRequestService.getPendingRequests();
        const pendingRequest = requests.find((r) => 
          String(r.patientId) === String(patientId) && 
          r.type === 'activation' && r.requestedStatus === 'active'
        );

        if (!pendingRequest) {
          toast.error('La solicitud ya fue resuelta');
          setDisabledActivities(prev => ({ ...prev, [activityId]: true }));
          return;
        }

        setActivities(prev => prev.filter(a => a._id !== activity._id));
        try {
          await activityService.markAsRead(activity._id);
        } catch (error) {
          console.error('Error al marcar actividad como leída:', error);
        }

        navigate('/admin/pacientes', {
          state: {
            from: 'activities',
            openActivationRequest: {
              patientId: String(patientId),
              requestId: pendingRequest.id,
            },
          },
        });
      } catch (error) {
        console.error('Error al validar solicitud:', error);
        toast.error('No se pudo validar la solicitud');
        setDisabledActivities(prev => ({ ...prev, [activity._id]: false }));
      }
    }
  };

  useEffect(() => {
    loadActivities();
  }, []);

  const loadActivities = async () => {
    try {
      setLoading(true);
      const data = await activityService.getActivities();
      const translatedActivities = data.map(translateActivity);
      setActivities(translatedActivities);
      setError(null);

      // Verificar qué actividades de frecuencia y status ya están resueltas
      try {
        const [pendingFrequencyRequests, pendingStatusRequests] = await Promise.all([
          frequencyRequestService.getPendingRequests(),
          statusRequestService.getPendingRequests()
        ]);
        
        const pendingFrequencyPatientIds = new Set(
          pendingFrequencyRequests.map(r => String(r.patientId))
        );
        
        const pendingDischargePatientIds = new Set(
          pendingStatusRequests
            .filter(r => r.requestedStatus === 'inactive' && r.type !== 'activation')
            .map(r => String(r.patientId))
        );
        
        const pendingActivationPatientIds = new Set(
          pendingStatusRequests
            .filter(r => r.type === 'activation' && r.requestedStatus === 'active')
            .map(r => String(r.patientId))
        );
        
        const resolved: Record<string, boolean> = {};
        translatedActivities.forEach(activity => {
          if (activity.metadata?.patientId) {
            const patientId = String(activity.metadata.patientId);
            
            // Verificar actividades de frecuencia
            if (
              activity.type === 'FREQUENCY_CHANGE_REQUEST' || 
              activity.type === 'FREQUENCY_CHANGE_REQUESTED'
            ) {
              if (!pendingFrequencyPatientIds.has(patientId)) {
                resolved[activity._id] = true;
              }
            }
            
            // Verificar actividades de baja
            if (activity.type === 'PATIENT_DISCHARGE_REQUEST') {
              if (!pendingDischargePatientIds.has(patientId)) {
                resolved[activity._id] = true;
              }
            }
            
            // Verificar actividades de activación
            if (activity.type === 'PATIENT_ACTIVATION_REQUEST') {
              if (!pendingActivationPatientIds.has(patientId)) {
                resolved[activity._id] = true;
              }
            }
          }
        });
        setDisabledActivities(resolved);
      } catch (error) {
        console.error('Error al verificar solicitudes pendientes:', error);
        // Si falla, no marcamos nada como resuelto para mantener el comportamiento actual
      }
    } catch (error) {
      console.error('Error loading activities:', error);
      setError('Error al cargar las actividades');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (activityId: string) => {
    try {
      await activityService.markAsRead(activityId);
      setActivities(activities.map(activity => 
        activity._id === activityId 
          ? { ...activity, read: true }
          : activity
      ));
    } catch (error) {
      console.error('Error marking activity as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await activityService.markAllAsRead();
      setActivities(activities.map(activity => ({ ...activity, read: true })));
    } catch (error) {
      console.error('Error marking all activities as read:', error);
    }
  };

  const handleClearAll = async () => {
    setShowConfirm(true);
  };

  const confirmClearAll = async () => {
    setShowConfirm(false);
    try {
      await activityService.clearAllActivities();
      setActivities([]);
      toast.success('Actividades eliminadas correctamente');
    } catch (error) {
      console.error('Error clearing activities:', error);
      toast.error('No se pudieron eliminar las actividades');
    }
  };

  const handleBack = () => {
    if (user?.role === 'admin') {
      navigate('/admin');
      return;
    }
    if (user?.role === 'professional') {
      navigate('/professional');
      return;
    }
    navigate('/');
  };

  const getRelativeTime = (date: string) => {
    const now = new Date();
    const activityDate = new Date(date);
    const diffInMinutes = Math.floor((now.getTime() - activityDate.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `Hace ${diffInMinutes} minutos`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `Hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `Hace ${days} ${days === 1 ? 'día' : 'días'}`;
    }
  };

  let content: React.ReactNode;

  if (loading) {
    content = (
      <div className="p-4">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  } else if (error) {
    content = (
      <div className="p-4 text-red-600">
        <p>{error}</p>
        <button 
          onClick={loadActivities}
          className="mt-2 text-blue-600 hover:text-blue-800"
        >
          Reintentar
        </button>
      </div>
    );
  } else {
    content = (
      <div className="divide-y divide-gray-200">
        {filteredActivities.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <BellIcon className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2">No hay notificaciones pendientes</p>
          </div>
        ) : (
          filteredActivities.map((activity) => {
            const translated = translateActivity(activity);
            const isFrequencyRequest =
              translated.type === 'FREQUENCY_CHANGE_REQUEST' || translated.type === 'FREQUENCY_CHANGE_REQUESTED';
            const isStatusRequest =
              translated.type === 'PATIENT_DISCHARGE_REQUEST' || translated.type === 'PATIENT_ACTIVATION_REQUEST';
            const isManageable = isFrequencyRequest || isStatusRequest;

            return (
              <div
                key={translated._id}
                className={`p-4 ${!translated.read ? 'bg-blue-50' : ''} hover:bg-gray-50`}
              >
                <div className="flex items-start space-x-3">
                  <span className="text-2xl">🔔</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {translated.title}
                    </p>
                    <p className="text-sm text-gray-500">
                      {translated.description}
                    </p>
                    {translated.metadata?.reason && (
                      <p className="mt-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                        <span className="font-medium">Motivo:</span> {translated.metadata.reason}
                      </p>
                    )}
                    {translated.metadata?.professionalName && (
                      <p className="text-xs text-gray-500 mt-2">
                        Solicitado por: {translated.metadata.professionalName}
                      </p>
                    )}
                    <div className="mt-3 flex items-center gap-3">
                      <p className="text-xs text-gray-400">
                        {getRelativeTime(translated.date)}
                      </p>
                      {isManageable && (
                        <button
                          onClick={() => handleActivityClick(translated)}
                          disabled={!!disabledActivities[translated._id]}
                          className={`text-xs font-semibold ${disabledActivities[translated._id] ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-800'}`}
                          title={disabledActivities[translated._id] ? 'La solicitud ya fue resuelta' : 'Gestionar solicitud'}
                        >
                          {disabledActivities[translated._id] ? 'Resuelto' : 'Gestionar solicitud'}
                        </button>
                      )}
                    </div>
                  </div>
                  {!translated.read && (
                    <button
                      onClick={() => handleMarkAsRead(translated._id)}
                      className="flex-shrink-0"
                    >
                      <CheckCircleIcon className="h-5 w-5 text-blue-600 hover:text-blue-800" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="md:flex md:items-center md:justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              Volver
            </button>
            <div>
              <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                Actividad Reciente
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Aquí puedes ver todas las actividades y notificaciones recientes del sistema
              </p>
            </div>
          </div>
          <div className="mt-4 md:mt-0 flex space-x-3">
            {activities.some(a => !a.read) && (
              <button
                onClick={handleMarkAllAsRead}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Marcar todo como leído
              </button>
            )}
            {activities.length > 0 && (
              <button
                onClick={handleClearAll}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                <TrashIcon className="h-5 w-5 mr-2" />
                Limpiar Registros
              </button>
            )}
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow">
          {content}
        </div>
      </div>
      <ConfirmationModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={confirmClearAll}
        title="¿Eliminar todas las actividades?"
        message="¿Estás seguro de que deseas eliminar todas las actividades? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        type="danger"
      />
    </div>
  );
};

export default ActivityPage; 