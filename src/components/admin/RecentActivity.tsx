import React, { useState, useEffect } from 'react';
import { Activity } from '../../types/Activity';
import activityService from '../../services/activity.service';
import { BellIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';

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

const RecentActivity: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filteredActivities = activities.filter(activity =>
    RELEVANT_ACTIVITY_TYPES.includes(activity.type)
  );

  useEffect(() => {
    loadActivities();
  }, []);

  const loadActivities = async () => {
    try {
      setLoading(true);
      const data = await activityService.getActivities();
      setActivities(data);
      setError(null);
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

  // const getActivityIcon = (type: Activity['type']) => {
  //   switch (type) {
  //     case 'NEW_POST':
  //       return '📝';
  //     case 'NEW_PATIENT':
  //       return '👤';
  //     case 'APPOINTMENT_COMPLETED':
  //       return '✅';
  //     case 'PATIENT_DISCHARGE_REQUEST':
  //       return '🔔';
  //     case 'NEW_MESSAGE':
  //       return '✉️';
  //     default:
  //       return '📌';
  //   }
  // };

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

  if (loading) {
    return (
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
  }

  if (error) {
    return (
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
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">Notificaciones del sistema</h2>
          {activities.some(a => !a.read) && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Marcar todo como leído
            </button>
          )}
        </div>
      </div>

      <div className="divide-y divide-gray-200">
        {filteredActivities.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <BellIcon className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2">No hay notificaciones pendientes</p>
          </div>
        ) : (
          filteredActivities.map((activity) => (
            <div
              key={activity._id}
              className={`p-4 ${!activity.read ? 'bg-blue-50' : ''} hover:bg-gray-50`}
            >
              <div className="flex items-start space-x-3">
                <span className="text-2xl">🔔</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {activity.title}
                  </p>
                  <p className="text-sm text-gray-500">
                    {activity.description}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {getRelativeTime(activity.date)}
                  </p>
                  {activity.metadata?.reason && (
                    <p className="text-sm text-gray-600 mt-1 bg-gray-50 p-2 rounded">
                      Motivo: {activity.metadata.reason}
                    </p>
                  )}
                </div>
                {!activity.read && (
                  <button
                    onClick={() => handleMarkAsRead(activity._id)}
                    className="flex-shrink-0"
                  >
                    <CheckCircleIcon className="h-5 w-5 text-blue-600 hover:text-blue-800" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t border-gray-200">
        <Link
          to="/admin/actividad"
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          Ver todo
        </Link>
      </div>
    </div>
  );
};

export default RecentActivity; 