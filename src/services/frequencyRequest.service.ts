import api from '../config/api';

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
			return response.data.data;
	},

	// Obtener todas las solicitudes pendientes
	getPendingRequests: async (): Promise<FrequencyRequest[]> => {
			const response = await api.get<{data: FrequencyRequest[]}>(
				'/frequency-requests/pending'
			);
			return response.data.data;
	},

	// Obtener solicitudes de un paciente específico
	getPatientRequests: async (
		patientId: string
	): Promise<FrequencyRequest[]> => {
			const response = await api.get<{data: FrequencyRequest[]}>(
				`/frequency-requests/patient/${patientId}`
			);
			return response.data.data;
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
			return response.data.data;
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
			return response.data.data;
	},
};

export default frequencyRequestService;
