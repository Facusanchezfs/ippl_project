import api from '../config/api';

export type RecurringFrequency = 'weekly' | 'biweekly' | 'monthly' | 'twice_weekly';

export interface CreateRecurringAppointmentDTO {
  baseAppointmentId: number;
  frequency: RecurringFrequency;
}

export interface SingleScheduleResponse {
  mode: 'single';
  recurringId: string | number;
  frequency: Exclude<RecurringFrequency, 'twice_weekly'>;
  nextDate: string;
  startTime: string;
  duration: 30 | 60;
  sessionCost: number;
}

export interface GroupScheduleResponse {
  mode: 'group';
  groupId: string;
  frequency: 'twice_weekly';
  entries: Array<{
    recurringId: string | number;
    nextDate: string;
    startTime: string;
    duration: 30 | 60;
    sessionCost: number;
  }>;
}

export type PatientRecurringSchedule = SingleScheduleResponse | GroupScheduleResponse | null;

class RecurringAppointmentsService {
  async createRecurringAppointment(data: CreateRecurringAppointmentDTO) {
    try {
      const response = await api.post('/recurring-appointments', data);
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error creating recurring appointment:', error);
      throw error;
    }
  }

  async updateRecurringAppointmentAdmin(
    id: string | number,
    data: {
      frequency: RecurringFrequency;
      nextDate: string;
      startTime: string;
      duration: 30 | 60;
      sessionCost: number;
    }
  ) {
    try {
      const response = await api.patch(`/admin/recurring-appointments/${id}`, data);
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error updating recurring appointment:', error);
      throw error;
    }
  }

  async updateRecurringAppointmentGroupAdmin(
    groupId: string,
    data: {
      entries: Array<{
        recurringId: string | number;
        nextDate: string;
        startTime: string;
        duration: 30 | 60;
        sessionCost: number;
      }>;
      active?: boolean;
    }
  ) {
    try {
      const response = await api.patch(`/admin/recurring-appointments/group/${groupId}`, data);
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error updating recurring appointment group:', error);
      throw error;
    }
  }

  async getPatientRecurringScheduleAdmin(patientId: string): Promise<PatientRecurringSchedule> {
    try {
      const response = await api.get(`/admin/patients/${patientId}/recurring`);
      return response.data?.data || response.data;
    } catch (error: any) {
      // Si no hay agenda recurrente, devolver null en lugar de lanzar error
      if (error?.response?.status === 404) {
        return null;
      }
      console.error('Error fetching patient recurring schedule:', error);
      throw error;
    }
  }

  /** Igual que updateRecurringAppointmentAdmin pero vía PATCH /admin/patients/:id/recurring (tabla + citas). */
  async patchPatientRecurringScheduleAdmin(
    patientId: string,
    data: {
      recurringId: string | number;
      frequency: RecurringFrequency;
      nextDate: string;
      startTime: string;
      duration: 30 | 60;
      sessionCost: number;
    }
  ) {
    try {
      const response = await api.patch(`/admin/patients/${patientId}/recurring`, data);
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error patching patient recurring schedule:', error);
      throw error;
    }
  }

  async createPatientRecurringScheduleAdmin(
    patientId: string,
    data:
      | {
          frequency: Exclude<RecurringFrequency, 'twice_weekly'>;
          nextDate: string;
          startTime: string;
          duration: 30 | 60;
          sessionCost: number;
        }
      | {
          frequency: 'twice_weekly';
          entries: Array<{
            nextDate: string;
            startTime: string;
            duration: 30 | 60;
            sessionCost: number;
          }>;
        }
  ) {
    try {
      const response = await api.post(`/admin/patients/${patientId}/recurring`, data);
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error creating patient recurring schedule:', error);
      throw error;
    }
  }
}

const recurringAppointmentsService = new RecurringAppointmentsService();
export default recurringAppointmentsService;
