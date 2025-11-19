import api from '../config/api';
import { Appointment } from '../types/Appointment';

export interface CreateAppointmentDTO {
  patientId: string;
  professionalId: string;
  date: string;
  startTime: string;
  endTime: string;
  type: 'regular' | 'first_time' | 'emergency';
  notes?: string;
  audioNote?: string;
  sessionCost?: number;
}

class AppointmentsService {
  async getAllAppointments(): Promise<Appointment[]> {
    try {
      const response = await api.get<{data: {appointments: Appointment[]}}>('/appointments');
      return response.data.data.appointments || [];
    } catch (error) {
      console.error('Error fetching all appointments:', error);
      return [];
    }
  }

  async getUpcomingAppointments(): Promise<Appointment[]> {
    try {
      const response = await api.get('/appointments/upcoming');
      return response.data.data.appointments || [];
    } catch (error) {
      console.error('Error fetching upcoming appointments:', error);
      return [];
    }
  }

  async getProfessionalAppointments(professionalId: string): Promise<Appointment[]> {
    try {
      const response = await api.get(`/appointments/professional/${professionalId}`);
      return response.data.data.appointments || [];
    } catch (error) {
      console.error('Error fetching professional appointments:', error);
      return [];
    }
  }

    async getTodayProfessionalAppointments(professionalId: string): Promise<Appointment[]> {
    try {
      const response = await api.get(`/appointments/professional/today/${professionalId}`);
      return response.data.data.appointments || [];
    } catch (error) {
      console.error('Error fetching today professional appointments:', error);
      return [];
    }
  }

  async getPatientAppointments(patientId: string): Promise<Appointment[]> {
    try {
      const response = await api.get(`/appointments/patient/${patientId}`);
      return response.data.data.appointments || [];
    } catch (error) {
      console.error('Error fetching patient appointments:', error);
      return [];
    }
  }

  async createAppointment(appointmentData: Partial<Appointment>): Promise<Appointment> {
    try {
      const response = await api.post<{data: Appointment}>('/appointments', appointmentData);
      return response.data.data;
    } catch (error) {
      console.error('Error creating appointment:', error);
      throw error;
    }
  }

  async updateAppointment(appointmentId: string, appointmentData: Partial<Appointment>): Promise<Appointment> {
    try {
      const response = await api.put<{data: Appointment}>(`/appointments/${appointmentId}`, appointmentData);
      return response.data.data;
    } catch (error) {
      console.error('Error updating appointment:', error);
      throw error;
    }
  }

  async deleteAppointment(appointmentId: string, appointmentData?: Partial<Appointment>): Promise<void> {
    try {
      // Primero obtenemos los detalles de la cita si no se proporcionaron
      let appointment = appointmentData;
      if (!appointment) {
        const response = await api.get(`/appointments/${appointmentId}`);
        appointment = response.data.data;
      }

      // Eliminamos la cita
      await api.delete(`/appointments/${appointmentId}`);

    } catch (error) {
      console.error('Error deleting appointment:', error);
      throw new Error('No se pudo eliminar la cita. Por favor, inténtalo de nuevo.');
    }
  }

  async getAvailableSlots(professionalId: string, date: string): Promise<string[]> {
    try {
      const response = await api.get(`/appointments/slots/${professionalId}`, {
        params: { date }
      });
      return response.data.data.slots || [];
    } catch (error) {
      console.error('Error fetching available slots:', error);
      return [];
    }
  }

  async updateAppointmentStatus(id: string, status: string, appointmentData: any): Promise<any> {
    try {
      const response = await api.put(`/appointments/${id}/status`, { status });
      return response.data.data;
    } catch (error) {
      console.error('Error al actualizar estado de cita:', error);
      throw error;
    }
  }
}

const appointmentsService = new AppointmentsService();
export default appointmentsService; 