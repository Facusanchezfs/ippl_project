import api from '../config/api';

export interface AppointmentCancellationRequest {
  id: string;
  appointmentId: string;
  professionalId: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt?: string;
  appointment?: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    patientName: string;
    professionalName: string;
  };
}

const appointmentCancellationRequestService = {
  async create(appointmentId: string, reason: string): Promise<AppointmentCancellationRequest> {
    const response = await api.post<{ data: AppointmentCancellationRequest }>(
      '/appointment-cancellation-requests',
      { appointmentId, reason }
    );
    return response.data?.data || (response.data as any) || ({} as AppointmentCancellationRequest);
  },

  async getAll(): Promise<AppointmentCancellationRequest[]> {
    const response = await api.get('/appointment-cancellation-requests');
    const raw = response.data;
    const data = (raw && typeof raw === 'object' && 'data' in raw ? (raw as any).data : raw) ?? {};

    // { data: { requests: [...] } } o { requests: [...] }
    if (
      data &&
      typeof data === 'object' &&
      'requests' in data &&
      Array.isArray((data as any).requests)
    ) {
      return (data as any).requests as AppointmentCancellationRequest[];
    }

    // { data: [...] } o respuesta directa [...]
    if (Array.isArray(data)) {
      return data as AppointmentCancellationRequest[];
    }

    return [];
  },

  async approve(id: string): Promise<AppointmentCancellationRequest> {
    const response = await api.patch<{ data: AppointmentCancellationRequest }>(
      `/appointment-cancellation-requests/${id}/approve`
    );
    return response.data?.data || (response.data as any) || ({} as AppointmentCancellationRequest);
  },

  async reject(id: string): Promise<AppointmentCancellationRequest> {
    const response = await api.patch<{ data: AppointmentCancellationRequest }>(
      `/appointment-cancellation-requests/${id}/reject`
    );
    return response.data?.data || (response.data as any) || ({} as AppointmentCancellationRequest);
  },
};

export default appointmentCancellationRequestService;

