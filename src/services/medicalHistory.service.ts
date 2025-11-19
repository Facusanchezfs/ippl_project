import api from '../config/api';

export interface MedicalHistory {
  id: string;
  patientId: string;
  date: string;
  diagnosis: string;
  treatment: string;
  notes: string;
  professionalId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMedicalHistoryDto {
  patientId: string;
  date: string;
  diagnosis: string;
  treatment: string;
  notes: string;
}

export interface UpdateMedicalHistoryDto {
  diagnosis?: string;
  treatment?: string;
  notes?: string;
}

const handleError = (error: any) => {
  if (error.response) {
    // El servidor respondió con un código de error
    console.error('Error response:', error.response.data);
    throw new Error(error.response.data.message || 'Error en la solicitud');
  } else if (error.request) {
    // La solicitud se hizo pero no se recibió respuesta
    console.error('Error request:', error.request);
    throw new Error('No se recibió respuesta del servidor');
  } else {
    // Algo sucedió en la configuración de la solicitud
    console.error('Error:', error.message);
    throw new Error('Error al realizar la solicitud');
  }
};

const medicalHistoryService = {
  // Obtener todos los historiales médicos
  getAllMedicalHistories: async () => {
    try {
      const response = await api.get<{data: MedicalHistory[]}>('/medical-history');
      return response.data.data;
    } catch (error) {
      handleError(error);
      return [];
    }
  },

  // Obtener historiales médicos por paciente
  getPatientMedicalHistories: async (patientId: string) => {
    try {
      const response = await api.get<{data: MedicalHistory[]}>(`/medical-history/patient/${patientId}`);
      return response.data.data;
    } catch (error) {
      handleError(error);
      return [];
    }
  },

  // Obtener historiales médicos por profesional
  getProfessionalMedicalHistories: async (professionalId: string) => {
    try {
      const response = await api.get<{data: MedicalHistory[]}>(`/medical-history/professional/${professionalId}`);
      return response.data.data;
    } catch (error) {
      handleError(error);
      return [];
    }
  },

  // Obtener un historial médico específico
  getMedicalHistoryById: async (id: string) => {
    try {
      const response = await api.get<{data: MedicalHistory}>(`/medical-history/${id}`);
      return response.data.data;
    } catch (error) {
      handleError(error);
      return null;
    }
  },

  // Crear un nuevo historial médico
  createMedicalHistory: async (data: CreateMedicalHistoryDto) => {
    try {
      const response = await api.post<{data: MedicalHistory}>('/medical-history', data);
      return response.data.data;
    } catch (error) {
      handleError(error);
      return null;
    }
  },

  // Actualizar un historial médico
  updateMedicalHistory: async (id: string, data: UpdateMedicalHistoryDto) => {
    try {
      const response = await api.put<{data: MedicalHistory}>(`/medical-history/${id}`, data);
      return response.data.data;
    } catch (error) {
      handleError(error);
      return null;
    }
  },

  // Eliminar un historial médico
  deleteMedicalHistory: async (id: string) => {
    try {
      const response = await api.delete(`/medical-history/${id}`);
      return response.data.data;
    } catch (error) {
      handleError(error);
      return null;
    }
  }
};

export default medicalHistoryService; 