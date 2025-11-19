import api from '../config/api';
import { StatusRequest } from '../types/StatusRequest';

const statusRequestService = {
	createRequest: async (
		data: Omit<StatusRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>
	): Promise<StatusRequest> => {
		const response = await api.post<{data: StatusRequest}>('/status-requests', data);
		return response.data.data;
	},

	getPendingRequests: async (): Promise<StatusRequest[]> => {
		const response = await api.get<{ data: { requests: StatusRequest[] } }>(
			'/status-requests/pending'
		);
		return response.data.data.requests;
	},

	getProfessionalRequests: async (
		professionalId: string
	): Promise<StatusRequest[]> => {
		const response = await api.get<{ data: { requests: StatusRequest[] } }>(
			`/status-requests/professional/${professionalId}`
		);
		return response.data.data.requests;
	},

	approveRequest: async (
		requestId: string,
		adminResponse?: string
	): Promise<StatusRequest> => {
		const response = await api.post<{data: StatusRequest}>(
			`/status-requests/${requestId}/approve`,
			{ adminResponse }
		);
		return response.data.data;
	},

	rejectRequest: async (
		requestId: string,
		adminResponse?: string
	): Promise<StatusRequest> => {
		const response = await api.post<{data: StatusRequest}>(
			`/status-requests/${requestId}/reject`,
			{ adminResponse: adminResponse || 'Rechazado por el administrador' }
		);
		return response.data.data;
	},
};

export default statusRequestService;
