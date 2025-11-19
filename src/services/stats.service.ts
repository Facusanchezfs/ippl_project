import api from '../config/api';
import appointmentsService from './appointments.service';

export interface SystemStats {
	users: {
		total: number;
		byRole: {
			admin: number;
			professional: number;
			content_manager: number;
		};
		active: number;
	};
	patients: {
		total: number;
		active: number;
		withAppointments: number;
		byProfessional: Record<string, number>;
	};
	posts: {
		total: number;
		published: number;
		drafts: number;
		comments: number;
		totalViews: number;
		totalLikes: number;
		bySection: Record<string, number>;
	};
	appointments: {
		upcoming: number;
		completed: number;
	};
}

export interface ProfessionalStats {
	patients: {
		total: number;
		active: number;
		withUpcomingAppointments: number;
	};
	appointments: {
		completed: number;
		upcoming: number;
	};
	notes: {
		total: number;
		audio: number;
	};
}

const statsService = {
	getSystemStats: async (): Promise<SystemStats> => {
		const [statsResponse, upcomingAppointments] = await Promise.all([
			api.get<{data: SystemStats}>('/stats/system'),
			appointmentsService.getUpcomingAppointments(),
		]);

		const stats = statsResponse.data?.data || statsResponse.data || {};
		
		return {
			users: stats.users || { total: 0, active: 0, byRole: { admin: 0, professional: 0, content_manager: 0 } },
			patients: stats.patients || { total: 0, active: 0, withAppointments: 0, byProfessional: {} },
			posts: stats.posts || { total: 0, published: 0, drafts: 0, comments: 0, totalViews: 0, totalLikes: 0, bySection: {} },
			appointments: {
				...(stats.appointments || { completed: 0 }),
				upcoming: Array.isArray(upcomingAppointments) ? upcomingAppointments.length : 0,
			},
		};
	},

	getProfessionalStats: async (
		professionalId: string
	): Promise<ProfessionalStats> => {
		const [statsResponse, upcomingAppointments] = await Promise.all([
			api.get<ProfessionalStats>(`/stats/professional/${professionalId}`),
			appointmentsService.getUpcomingAppointments(),
		]);

		const professionalUpcoming = upcomingAppointments.filter(
			(app) => app.professionalId === professionalId
		);

		return {
			...statsResponse.data,
			appointments: {
				...statsResponse.data.appointments,
				upcoming: professionalUpcoming.length,
			},
		};
	},
};

export default statsService;
