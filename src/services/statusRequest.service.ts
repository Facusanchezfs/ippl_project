import api from '../config/api';
import { StatusRequest } from '../types/StatusRequest';

const statusRequestService = {
	createRequest: async (
		data: Omit<StatusRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>
	): Promise<StatusRequest> => {
		const response = await api.post<{data: StatusRequest}>('/status-requests', data);
		return response.data?.data || response.data || {
			id: '',
			patientId: data.patientId,
			patientName: data.patientName,
			professionalId: data.professionalId,
			professionalName: data.professionalName,
			currentStatus: data.currentStatus,
			requestedStatus: data.requestedStatus,
			reason: data.reason,
			status: 'pending',
			createdAt: new Date().toISOString(),
			type: data.type
		};
	},

	getPendingRequests: async (): Promise<StatusRequest[]> => {
		const response = await api.get('/status-requests/pending');
		const data = response.data?.data || response.data || {};
		
		if ('requests' in data && Array.isArray(data.requests)) {
			return data.requests;
		}
		if (Array.isArray(data)) {
			return data;
		}
		return [];
	},

	getProfessionalRequests: async (
		professionalId: string
	): Promise<StatusRequest[]> => {
		const response = await api.get(`/status-requests/professional/${professionalId}`);
		const data = response.data?.data || response.data || {};
		
		if ('requests' in data && Array.isArray(data.requests)) {
			return data.requests;
		}
		if (Array.isArray(data)) {
			return data;
		}
		return [];
	},

	approveRequest: async (
		requestId: string,
		adminResponse?: string
	): Promise<StatusRequest> => {
		const response = await api.post<{data: StatusRequest}>(
			`/status-requests/${requestId}/approve`,
			{ adminResponse }
		);
		return response.data?.data || response.data || {
			id: requestId,
			patientId: '',
			patientName: '',
			professionalId: '',
			professionalName: '',
			currentStatus: 'active',
			requestedStatus: 'active',
			reason: '',
			status: 'approved',
			createdAt: new Date().toISOString(),
			adminResponse
		};
	},

	rejectRequest: async (
		requestId: string,
		adminResponse?: string
	): Promise<StatusRequest> => {
		const response = await api.post<{data: StatusRequest}>(
			`/status-requests/${requestId}/reject`,
			{ adminResponse: adminResponse || 'Rechazado por el administrador' }
		);
		return response.data?.data || response.data || {
			id: requestId,
			patientId: '',
			patientName: '',
			professionalId: '',
			professionalName: '',
			currentStatus: 'active',
			requestedStatus: 'active',
			reason: '',
			status: 'rejected',
			createdAt: new Date().toISOString(),
			adminResponse: adminResponse || 'Rechazado por el administrador'
		};
	},
};

export default statusRequestService;
