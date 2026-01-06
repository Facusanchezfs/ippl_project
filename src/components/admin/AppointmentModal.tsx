import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import api from '../../config/api';
import Modal from '../Modal';
import AudioRecorder from '../AudioRecorder';
import { Professional } from '../../types/Professional';
import { Patient } from '../../types/Patient';
import { Appointment } from '../../types/Appointment';

interface CreateAppointmentDTO {
  patientId: string;
  professionalId: string;
  type: string;
  notes: string;
  date: string;
  startTime: string;
  audioNote?: string;
}

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateAppointmentDTO & { audioNote?: string }) => void;
  selectedDate?: Date;
  selectedTime?: string;
  selectedAppointment?: Appointment;
}

const AppointmentModal: React.FC<AppointmentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  selectedDate,
  selectedTime,
  selectedAppointment
}) => {
  const { user } = useAuth();
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [formData, setFormData] = useState({
    patientId: '',
    professionalId: user?.role === 'professional' ? user.id : '',
    type: '',
    notes: '',
    audioNote: ''
  });

  useEffect(() => {
    if (isOpen) {
      loadPatients();
      if (user?.role === 'admin') {
        loadProfessionals();
      }
      
      if (selectedAppointment) {
        setFormData({
          patientId: selectedAppointment.patientId,
          professionalId: selectedAppointment.professionalId,
          type: selectedAppointment.type,
          notes: selectedAppointment.notes || '',
          audioNote: selectedAppointment.audioNote || ''
        });
      } else {
        setFormData({
          patientId: '',
          professionalId: user?.role === 'professional' ? user.id : '',
          type: '',
          notes: '',
          audioNote: ''
        });
      }
    }
  }, [isOpen, selectedAppointment, user]);

  const loadPatients = async () => {
    try {
      const response = await api.get('/patients');
      setPatients(response.data.data.patients || []);
    } catch (error) {
      console.error('Error al cargar pacientes:', error);
      toast.error('Error al cargar la lista de pacientes');
    }
  };

  const loadProfessionals = async () => {
    try {
      const response = await api.get('/professionals');
      setProfessionals(response.data.data.professionals || []);
    } catch (error) {
      console.error('Error al cargar profesionales:', error);
      toast.error('Error al cargar la lista de profesionales');
    }
  };

  const handleAudioRecordingComplete = async (blob: Blob) => {
    try {
      const formData = new FormData();
      const audioFile = new File([blob], 'audio-note.wav', { type: 'audio/wav' });
      formData.append('audio', audioFile);

      const response = await api.post('/upload/audio', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setFormData(prev => ({
        ...prev,
        audioNote: response.data.data.audioUrl
      }));

      toast.success('Audio grabado correctamente');
    } catch (error) {
      console.error('Error al subir el audio:', error);
      toast.error('Error al subir el audio');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !selectedTime) {
      toast.error('Fecha y hora son requeridas');
      return;
    }

    const appointmentData = {
      ...formData,
      date: format(selectedDate, 'yyyy-MM-dd'),
      startTime: selectedTime,
    };

    onSave(appointmentData);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="text-xl font-semibold mb-4">
          {selectedAppointment ? 'Editar Cita' : 'Nueva Cita'}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Paciente
            </label>
            <select
              value={formData.patientId}
              onChange={(e) => setFormData(prev => ({ ...prev, patientId: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              required
            >
              <option value="">Seleccionar paciente</option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.name}
                </option>
              ))}
            </select>
          </div>

          {user?.role === 'admin' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Profesional
              </label>
              <select
                value={formData.professionalId}
                onChange={(e) => setFormData(prev => ({ ...prev, professionalId: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              >
                <option value="">Seleccionar profesional</option>
                {professionals.map((professional) => (
                  <option key={professional.id} value={professional.id}>
                    {professional.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Tipo de cita
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              required
            >
              <option value="">Seleccionar tipo</option>
              <option value="primera">Primera vez</option>
              <option value="seguimiento">Seguimiento</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Notas
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              rows={3}
            />
          </div>

          <div>
            <AudioRecorder onRecordingComplete={handleAudioRecordingComplete} />
            {formData.audioNote && (
              <audio
                src={formData.audioNote}
                controls
                className="mt-2 w-full"
              />
            )}
          </div>
        </div>

        <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
          <button
            type="submit"
            className="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:col-start-2 sm:text-sm"
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:col-start-1 sm:mt-0 sm:text-sm"
          >
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AppointmentModal; 