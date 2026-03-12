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
}

const recurringAppointmentsService = new RecurringAppointmentsService();
export default recurringAppointmentsService;
