import api from '../config/api';
import { Patient } from '../types/Patient';
import frequencyRequestService, { CreateFrequencyRequestDTO } from './frequencyRequest.service';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'


export interface CreatePatientDTO {
  name: string;
  description: string;
}

export interface AssignPatientDTO {
  patientId: string;
  professionalId: string;
  professionalName: string;
  status?: 'active' | 'pending' | 'inactive';
  assignedAt?: string;
  textNote?: string;
  audioNote?: string;
  sessionFrequency: 'weekly' | 'biweekly' | 'monthly';
  statusChangeReason?: string;
}

const patientsService = {
  getAllPatients: async (): Promise<Patient[]> => {
    try {
      const response = await api.get('/patients');
      const patients = response.data?.data?.patients || response.data?.data || response.data || [];
      const patientsArray = Array.isArray(patients) ? patients : [];
      return patientsArray.map((patient: Patient) => ({
        ...patient,
        audioNote: patient.audioNote ? `${API_URL}${patient.audioNote}` : undefined
      }));
    } catch (error) {
      console.error('Error fetching patients:', error);
      return [];
    }
  },

  getProfessionalPatients: async (professionalId: string): Promise<Patient[]> => {
    try {
      const response = await api.get(`/patients/professional/${professionalId}`);
      const patients = response.data?.data?.patients || response.data?.data || response.data || [];
      const patientsArray = Array.isArray(patients) ? patients : [];
      return patientsArray.map((patient: Patient) => ({
        ...patient,
        audioNote: patient.audioNote ? `${API_URL}${patient.audioNote}` : undefined
      }));
    } catch (error) {
      console.error('Error fetching professional patients:', error);
      return [];
    }
  },

  addPatient: async (patient: CreatePatientDTO): Promise<Patient> => {
    const response = await api.post<{data: Patient}>('/patients', patient);
    return response.data?.data || response.data || {
      id: '',
      name: patient.name,
      description: patient.description,
      status: 'pending',
      createdAt: new Date().toISOString(),
      sessionFrequency: 'weekly'
    };
  },

  assignPatient: async (data: AssignPatientDTO): Promise<Patient> => {
    const response = await api.put<{data: Patient}>(`/patients/${data.patientId}/assign`, data);
    return response.data?.data || response.data || {
      id: data.patientId,
      name: '',
      status: data.status || 'active',
      professionalId: data.professionalId,
      professionalName: data.professionalName,
      createdAt: new Date().toISOString(),
      assignedAt: data.assignedAt,
      textNote: data.textNote,
      sessionFrequency: data.sessionFrequency,
      statusChangeReason: data.statusChangeReason
    };
  },

  uploadAudio: async (audioFile: File): Promise<string> => {
    try {
      // Validar que el archivo tenga datos
      if (!audioFile || audioFile.size === 0) {
        throw new Error('El archivo de audio está vacío');
      }
      
      const formData = new FormData();
      formData.append('audio', audioFile);
      
      
      const response = await api.post('/upload/audio', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      // El backend devuelve { success: true, data: { audioUrl: ... } }
      const audioUrl = response.data?.data?.audioUrl || response.data?.data?.url;
      
      if (!audioUrl) {
        console.error('Estructura de respuesta inesperada:', response.data);
        throw new Error('No se recibió la URL del audio del servidor');
      }
      
      return audioUrl;
    } catch (error: any) {
      console.error('Error detallado al subir audio:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      // Personalizar el mensaje de error según el tipo de error
      if (error.response?.status === 400) {
        throw new Error('El archivo de audio no es válido o no fue proporcionado');
      } else if (error.response?.status === 413) {
        throw new Error('El archivo de audio es demasiado grande');
      } else if (error.response?.status === 415) {
        throw new Error('El formato del archivo de audio no es soportado');
      } else if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      } else {
        throw new Error('Error al subir el archivo de audio: ' + error.message);
      }
    }
  },

  updatePatient: async (id: string, patientData: any): Promise<any> => {
    try {
      const response = await api.put(`/patients/${id}/assign`, patientData);
      return response.data?.data || response.data || patientData;
    } catch (error) {
      console.error('Error al actualizar paciente:', error);
      throw error;
    }
  },

  deletePatient: async (id: string): Promise<void> => {
    try {
      await api.delete(`/patients/${id}`);

    } catch (error) {
      console.error('Error al eliminar paciente:', error);
      throw error;
    }
  },

  requestFrequencyChange: async (patientId: string, newFrequency: 'weekly' | 'biweekly' | 'monthly', reason: string): Promise<any> => {
    try {
      const requestData: CreateFrequencyRequestDTO = {
        patientId,
        newFrequency,
        reason
      };
      return await frequencyRequestService.createRequest(requestData);
    } catch (error) {
      console.error('Error al solicitar cambio de frecuencia:', error);
      throw error;
    }
  }
};

export default patientsService; 