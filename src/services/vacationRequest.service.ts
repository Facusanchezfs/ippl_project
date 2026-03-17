import api from '../config/api';

export interface VacationRequest {
  id: string;
  professionalId: string;
  startDate: string;
  endDate: string;
  weeksRequested: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt?: string;
}

const vacationRequestService = {
  async create(startDate: string, weeksRequested: number, reason?: string): Promise<VacationRequest> {
    const response = await api.post<{ data: VacationRequest }>(
      '/vacation-requests',
      { startDate, weeksRequested, reason }
    );
    return (
      response.data?.data ||
      (response.data as any) ||
      ({} as VacationRequest)
    );
  },

  async getMyRequests(): Promise<VacationRequest[]> {
    const response = await api.get('/vacation-requests/me');
    const raw = response.data;
    const data =
      (raw && typeof raw === 'object' && 'data' in raw
        ? (raw as any).data
        : raw) ?? {};

    if (
      data &&
      typeof data === 'object' &&
      'requests' in data &&
      Array.isArray((data as any).requests)
    ) {
      return (data as any).requests as VacationRequest[];
    }

    if (Array.isArray(data)) {
      return data as VacationRequest[];
    }

    return [];
  },

  async getAll(status?: 'pending' | 'approved' | 'rejected'): Promise<VacationRequest[]> {
    const response = await api.get('/vacation-requests', {
      params: status ? { status } : undefined,
    });
    const raw = response.data;
    const data =
      (raw && typeof raw === 'object' && 'data' in raw
        ? (raw as any).data
        : raw) ?? {};

    if (
      data &&
      typeof data === 'object' &&
      'requests' in data &&
      Array.isArray((data as any).requests)
    ) {
      return (data as any).requests as VacationRequest[];
    }

    if (Array.isArray(data)) {
      return data as VacationRequest[];
    }

    return [];
  },

  async approve(id: string): Promise<VacationRequest> {
    const response = await api.post<{ data: VacationRequest }>(
      `/vacation-requests/${id}/approve`
    );
    return (
      response.data?.data ||
      (response.data as any) ||
      ({} as VacationRequest)
    );
  },

  async reject(id: string): Promise<VacationRequest> {
    const response = await api.post<{ data: VacationRequest }>(
      `/vacation-requests/${id}/reject`
    );
    return (
      response.data?.data ||
      (response.data as any) ||
      ({} as VacationRequest)
    );
  },
};

export default vacationRequestService;

