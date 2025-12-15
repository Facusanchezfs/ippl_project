import api from '../config/api';

// Cache para getPendingRequests (TTL: 5 segundos)
let pendingRequestsCache: {
	data: FrequencyRequest[];
	timestamp: number;
} | null = null;

const CACHE_TTL_MS = 5000; // 5 segundos

export interface FrequencyRequest {
	id: string;
	patientId: string;
	patientName: string;
	professionalId: string;
	professionalName: string;
	currentFrequency: 'weekly' | 'biweekly' | 'monthly';
	requestedFrequency: 'weekly' | 'biweekly' | 'monthly';
	reason: string;
	status: 'pending' | 'approved' | 'rejected';
	adminResponse?: string;
	createdAt: string;
	updatedAt?: string;
}

export interface CreateFrequencyRequestDTO {
	patientId: string;
	newFrequency: 'weekly' | 'biweekly' | 'monthly';
	reason: string;
}

const frequencyRequestService = {
	// Crear una nueva solicitud
	createRequest: async (
		data: CreateFrequencyRequestDTO
	): Promise<FrequencyRequest> => {
			const response = await api.post<{data: FrequencyRequest}>(
				'/frequency-requests',
				data
			);
			// Invalidar cache al crear una solicitud
			pendingRequestsCache = null;
			return response.data?.data || response.data || {
				id: '',
				patientId: data.patientId,
				patientName: '',
				professionalId: '',
				professionalName: '',
				currentFrequency: 'weekly',
				requestedFrequency: data.newFrequency,
				reason: data.reason,
				status: 'pending',
				createdAt: new Date().toISOString()
			};
	},

	// Obtener todas las solicitudes pendientes (con cache)
	getPendingRequests: async (): Promise<FrequencyRequest[]> => {
		// Verificar si hay cache válido
		const now = Date.now();
		if (pendingRequestsCache && (now - pendingRequestsCache.timestamp) < CACHE_TTL_MS) {
			return pendingRequestsCache.data;
		}

		// Hacer fetch y actualizar cache
		const response = await api.get<{data: FrequencyRequest[]}>(
			'/frequency-requests/pending'
		);
		const requests = response.data?.data || response.data || [];
		const result = Array.isArray(requests) ? requests : [];
		
		// Actualizar cache
		pendingRequestsCache = {
			data: result,
			timestamp: now
		};
		
		return result;
	},

	// Obtener solicitudes de un paciente específico
	getPatientRequests: async (
		patientId: string
	): Promise<FrequencyRequest[]> => {
			const response = await api.get<{data: FrequencyRequest[]}>(
				`/frequency-requests/patient/${patientId}`
			);
			const requests = response.data?.data || response.data || [];
			return Array.isArray(requests) ? requests : [];
	},

	// Aprobar una solicitud
	approveRequest: async (
		requestId: string,
		adminResponse: string
	): Promise<FrequencyRequest> => {
			const response = await api.post<{data: FrequencyRequest}>(
				`/frequency-requests/${requestId}/approve`,
				{
					adminResponse,
				}
			);
			// Invalidar cache al aprobar una solicitud
			pendingRequestsCache = null;
			return response.data?.data || response.data || {
				id: requestId,
				patientId: '',
				patientName: '',
				professionalId: '',
				professionalName: '',
				currentFrequency: 'weekly',
				requestedFrequency: 'weekly',
				reason: '',
				status: 'approved',
				adminResponse,
				createdAt: new Date().toISOString()
			};
	},

	// Rechazar una solicitud
	rejectRequest: async (
		requestId: string,
		adminResponse: string
	): Promise<FrequencyRequest> => {
			const response = await api.post<{data: FrequencyRequest}>(
				`/frequency-requests/${requestId}/reject`,
				{
					adminResponse,
				}
			);
			// Invalidar cache al rechazar una solicitud
			pendingRequestsCache = null;
			return response.data?.data || response.data || {
				id: requestId,
				patientId: '',
				patientName: '',
				professionalId: '',
				professionalName: '',
				currentFrequency: 'weekly',
				requestedFrequency: 'weekly',
				reason: '',
				status: 'rejected',
				adminResponse,
				createdAt: new Date().toISOString()
			};
	},
};

export default frequencyRequestService;
