export type ActivityType = 
  | 'NEW_POST' 
  | 'NEW_PATIENT' 
  | 'APPOINTMENT_COMPLETED'
  | 'PATIENT_DISCHARGE_REQUEST'
  | 'PATIENT_ACTIVATION_REQUEST'
  | 'STATUS_CHANGE_APPROVED'
  | 'STATUS_CHANGE_REJECTED'
  | 'FREQUENCY_CHANGE_REQUEST'
  | 'FREQUENCY_CHANGE_REQUESTED'
  | 'FREQUENCY_CHANGE_APPROVED'
  | 'FREQUENCY_CHANGE_REJECTED'
  | 'NEW_MESSAGE';

export interface Activity {
  _id: string;
  type: ActivityType;
  title: string;
  description: string;
  date: string;
  metadata?: {
    patientId?: string;
    patientName?: string;
    professionalId?: string;
    professionalName?: string;
    postId?: string;
    postTitle?: string;
    appointmentId?: string;
    reason?: string;
    adminResponse?: string;
    [k: string]: unknown;
  };
  read: boolean;
} 