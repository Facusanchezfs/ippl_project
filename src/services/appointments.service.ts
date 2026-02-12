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

export interface PaginatedAppointmentsResponse {
  appointments: Appointment[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}


class AppointmentsService {
  async getAllAppointments(): Promise<Appointment[]> {
    try {
      const response = await api.get<{data: {appointments: Appointment[]}}>('/appointments');
      const appointments = response.data?.data?.appointments || response.data?.data || [];
      return Array.isArray(appointments) ? appointments : [];
    } catch (error) {
      console.error('Error fetching all appointments:', error);
      return [];
    }
  }

  async getUpcomingAppointments(): Promise<Appointment[]> {
    try {
      const response = await api.get('/appointments/upcoming');
      const appointments = response.data?.data?.appointments || response.data?.data || [];
      return Array.isArray(appointments) ? appointments : [];
    } catch (error) {
      console.error('Error fetching upcoming appointments:', error);
      return [];
    }
  }

  async getProfessionalAppointments(
    professionalId: string,
    page: number = 1,
    limit: number = 20,
    filter: "all" | "upcoming" | "past" = "all"
  ): Promise<PaginatedAppointmentsResponse> {
    try {
      const response = await api.get(
        `/appointments/professional/${professionalId}`,
        {
          params: { page, limit, filter }
        }
      );
  
      return response.data.data;
    } catch (error) {
      console.error("Error fetching professional appointments:", error);
      return {
        appointments: [],
        pagination: undefined
      };
    }
  }

  async getCompletedAppointments(
    professionalId: string
  ): Promise<Appointment[]> {
    try {
      const response = await api.get(
        `/appointments/professional/${professionalId}/completed`
      );
  
      return response.data.data.appointments || [];
    } catch (error) {
      console.error("Error fetching completed appointments:", error);
      return [];
    }
  }

  async getScheduledAppointments(
    professionalId: string
  ): Promise<Appointment[]> {
    try {
      const response = await api.get(
        `/appointments/professional/${professionalId}/scheduled`
      );
  
      // La respuesta puede venir en data.data.appointments o data.data
      const appointments = response.data?.data?.appointments || response.data?.data || [];
      return Array.isArray(appointments) ? appointments : [];
    } catch (error) {
      console.error("Error fetching scheduled appointments:", error);
      return [];
    }
  }
  
  

    async getTodayProfessionalAppointments(professionalId: string): Promise<Appointment[]> {
    try {
      const response = await api.get(`/appointments/professional/today/${professionalId}`);
      const appointments = response.data?.data?.appointments || response.data?.data || [];
      return Array.isArray(appointments) ? appointments : [];
    } catch (error) {
      console.error('Error fetching today professional appointments:', error);
      return [];
    }
  }

  async getPatientAppointments(patientId: string): Promise<Appointment[]> {
    try {
      const response = await api.get(`/appointments/patient/${patientId}`);
      const appointments = response.data?.data?.appointments || response.data?.data || [];
      return Array.isArray(appointments) ? appointments : [];
    } catch (error) {
      console.error('Error fetching patient appointments:', error);
      return [];
    }
  }

  async createAppointment(appointmentData: Partial<Appointment>): Promise<Appointment> {
    try {
      const response = await api.post<{data: Appointment}>('/appointments', appointmentData);
      return response.data?.data || response.data || {
        id: '',
        patientId: appointmentData.patientId || '',
        patientName: '',
        professionalId: appointmentData.professionalId || '',
        professionalName: '',
        date: appointmentData.date || '',
        startTime: appointmentData.startTime || '',
        endTime: appointmentData.endTime || '',
        type: appointmentData.type || 'regular',
        status: 'scheduled',
        notes: appointmentData.notes,
        audioNote: appointmentData.audioNote,
        sessionCost: appointmentData.sessionCost,
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error creating appointment:', error);
      throw error;
    }
  }

  async updateAppointment(appointmentId: string, appointmentData: Partial<Appointment>): Promise<Appointment> {
    try {
      const response = await api.put<{data: Appointment}>(`/appointments/${appointmentId}`, appointmentData);
      return response.data?.data || response.data || {
        id: appointmentId,
        patientId: appointmentData.patientId || '',
        patientName: appointmentData.patientName || '',
        professionalId: appointmentData.professionalId || '',
        professionalName: appointmentData.professionalName || '',
        date: appointmentData.date || '',
        startTime: appointmentData.startTime || '',
        endTime: appointmentData.endTime || '',
        type: appointmentData.type || 'regular',
        status: appointmentData.status || 'scheduled',
        notes: appointmentData.notes,
        audioNote: appointmentData.audioNote,
        sessionCost: appointmentData.sessionCost,
        createdAt: appointmentData.createdAt || new Date().toISOString()
      };
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
      const slots = response.data?.data?.slots || response.data?.slots || [];
      return Array.isArray(slots) ? slots : [];
    } catch (error) {
      console.error('Error fetching available slots:', error);
      return [];
    }
  }

  async updateAppointmentStatus(id: string, status: string): Promise<any> {
    try {
      const response = await api.put(`/appointments/${id}/status`, { status });
      return response.data?.data || response.data || {};
    } catch (error) {
      console.error('Error al actualizar estado de cita:', error);
      throw error;
    }
  }
}

const appointmentsService = new AppointmentsService();
export default appointmentsService; 