import api from '../config/api';
import { StatusRequest } from '../types/StatusRequest';

// Cache para getPendingRequests (TTL: 5 segundos)
let pendingRequestsCache: {
	data: StatusRequest[];
	timestamp: number;
} | null = null;

const CACHE_TTL_MS = 5000; // 5 segundos

const statusRequestService = {
	createRequest: async (
		data: Omit<StatusRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>
	): Promise<StatusRequest> => {
		const response = await api.post<{data: StatusRequest}>('/status-requests', data);
		// Invalidar cache al crear una solicitud
		pendingRequestsCache = null;
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
		// Verificar si hay cache válido
		const now = Date.now();
		if (pendingRequestsCache && (now - pendingRequestsCache.timestamp) < CACHE_TTL_MS) {
			return pendingRequestsCache.data;
		}

		// Hacer fetch y actualizar cache
		const response = await api.get('/status-requests/pending');
		const data = response.data?.data || response.data || {};
		
		let result: StatusRequest[] = [];
		if ('requests' in data && Array.isArray(data.requests)) {
			result = data.requests;
		} else if (Array.isArray(data)) {
			result = data;
		}
		
		// Actualizar cache
		pendingRequestsCache = {
			data: result,
			timestamp: now
		};
		
		return result;
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

	getPatientPendingRequests: async (
		patientId: string
	): Promise<StatusRequest[]> => {
		const response = await api.get(`/status-requests/patient/${patientId}/pending`);
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
		// Invalidar cache al aprobar una solicitud
		pendingRequestsCache = null;
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
		// Invalidar cache al rechazar una solicitud
		pendingRequestsCache = null;
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
