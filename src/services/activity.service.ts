import api from '../config/api';
import { Activity } from '../types/Activity';

export interface ActivitiesPagination {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
}

export interface ActivitiesTabTotals {
	unread: number;
	read: number;
}

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

	async getActivitiesPage(params: {
		page: number;
		limit: number;
		read?: boolean;
		includeTabTotals?: boolean;
	}): Promise<{
		activities: Activity[];
		pagination: ActivitiesPagination;
		tabTotals?: ActivitiesTabTotals;
	}> {
		const { page, limit, read, includeTabTotals } = params;
		try {
			const response = await api.get('/activities', {
				params: {
					page,
					limit,
					...(read !== undefined
						? { read: read ? 'true' : 'false' }
						: {}),
					...(includeTabTotals ? { includeTabTotals: 'true' } : {}),
				},
			});
			const raw = response.data?.data ?? response.data;
			if (!raw || typeof raw !== 'object') {
				return {
					activities: [],
					pagination: { page: 1, limit, total: 0, totalPages: 0 },
				};
			}
			if (!('activities' in raw) || !('pagination' in raw)) {
				return {
					activities: [],
					pagination: { page: 1, limit, total: 0, totalPages: 0 },
				};
			}
			const activities = Array.isArray((raw as { activities: unknown }).activities)
				? ((raw as { activities: Activity[] }).activities)
				: [];
			const p = (raw as { pagination: ActivitiesPagination }).pagination;
			const tabTotals = (raw as { tabTotals?: ActivitiesTabTotals }).tabTotals;
			return {
				activities,
				pagination: {
					page: p.page,
					limit: p.limit,
					total: p.total,
					totalPages: p.totalPages,
				},
				...(tabTotals ? { tabTotals } : {}),
			};
		} catch (error) {
			console.error('Error fetching activities (paginated):', error);
			return {
				activities: [],
				pagination: { page: 1, limit: params.limit, total: 0, totalPages: 0 },
			};
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
			const count = response.data?.data?.count || response.data?.count || 0;
			return typeof count === 'number' ? count : 0;
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
