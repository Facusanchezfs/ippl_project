import api from '../config/api';
import { Activity } from '../types/Activity';

const activityService = {
	// Obtener todas las actividades
	async getActivities(): Promise<Activity[]> {
		try {
			const response = await api.get('/activities');
			// Asegurar que siempre devolvemos un array
			const activities = response.data?.data || response.data || [];
			return Array.isArray(activities) ? activities : [];
		} catch (error) {
			console.error('Error fetching activities:', error);
			return [];
		}
	},

	// Marcar una actividad como leída
	async markAsRead(activityId: string): Promise<void> {
		try {
			await api.put(`/activities/${activityId}/read`);
		} catch (error) {
			console.error('Error marking activity as read:', error);
		}
	},

	// Marcar todas las actividades como leídas
	async markAllAsRead(): Promise<void> {
		try {
			await api.put('/activities/read-all');
		} catch (error) {
			console.error('Error marking all activities as read:', error);
		}
	},

	// Obtener el conteo de actividades no leídas
	async getUnreadCount(): Promise<number> {
		try {
			const response = await api.get('/activities/unread-count');
			return response.data.data.count || 0;
		} catch (error) {
			console.error('Error getting unread count:', error);
			return 0;
		}
	},

	// Limpiar todas las actividades
	async clearAllActivities(): Promise<void> {
		try {
			await api.delete('/activities/clear-all');
		} catch (error) {
			console.error('Error clearing activities:', error);
		}
	},
};

export default activityService;
