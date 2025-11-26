export interface Patient {
  id: string;
  name: string;
  email?: string;
  description?: string;
  status: 'active' | 'pending' | 'inactive';
  professionalId?: string;
  professionalName?: string;
  createdAt: string;
  assignedAt?: string;
  nextAppointment?: string;
  textNote?: string;
  sessionCost?: number;
  statusChangeReason?: string;
  activatedAt?: string;
  dischargeRequest?: {
    requestedBy: string;
    requestDate: string;
    reason: string;
    status: string;
  };
  activationRequest?: {
    requestedBy: string;
    requestDate: string;
    reason: string;
    status: string;
  };
  audioNote?: string;
  sessionFrequency: 'weekly' | 'biweekly' | 'monthly';
} 