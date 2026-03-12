import api from '../config/api';

export interface CreateRecurringAppointmentDTO {
  baseAppointmentId: number;
  frequency: 'weekly' | 'biweekly' | 'monthly';
}

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
      frequency: 'weekly' | 'biweekly' | 'monthly';
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

  async getPatientRecurringScheduleAdmin(patientId: string) {
    try {
      const response = await api.get(`/admin/patients/${patientId}/recurring`);
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error fetching patient recurring schedule:', error);
      throw error;
    }
  }
}

const recurringAppointmentsService = new RecurringAppointmentsService();
export default recurringAppointmentsService;
