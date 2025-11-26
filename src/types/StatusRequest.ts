export interface StatusRequest {
  id: string;
  patientId: string;
  patientName: string;
  professionalId: string;
  professionalName: string;
  currentStatus: 'active' | 'pending' | 'inactive';
  requestedStatus: 'active' | 'pending' | 'inactive';
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt?: string;
  adminResponse?: string;
  type?: 'activation' | 'status_change';
} 