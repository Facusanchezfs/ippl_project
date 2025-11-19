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

		return {
			...statsResponse.data.data,
			appointments: {
				...statsResponse.data.data.appointments,
				upcoming: upcomingAppointments.length,
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
