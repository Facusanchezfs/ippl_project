import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PlusIcon, TrashIcon, MicrophoneIcon, EyeIcon, ClockIcon, DocumentTextIcon, UserPlusIcon, BellIcon, MagnifyingGlassIcon, ArrowUpCircleIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import patientsService, { AssignPatientDTO, CreatePatientDTO } from '../../services/patients.service';
import { Patient } from '../../types/Patient';
import userService from '../../services/user.service';
import statusRequestService from '../../services/statusRequest.service';
import { StatusRequest } from '../../types/StatusRequest';
import toast from 'react-hot-toast';
import Modal from '../Modal';
import { useNavigate, useLocation } from 'react-router-dom';
import frequencyRequestService, { FrequencyRequest } from '../../services/frequencyRequest.service';

interface Professional {
  id: string;
  name: string;
}

interface AssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssign: (data: AssignPatientDTO) => Promise<void>;
  patient: Patient | null;
  professionals: Professional[];
}

const AssignModal: React.FC<AssignModalProps> = ({ isOpen, onClose, onAssign, patient, professionals }) => {
  const [selectedProfessional, setSelectedProfessional] = useState('');
  const [status, setStatus] = useState<'active' | 'pending' | 'inactive'>(patient?.status || 'active');
  const [sessionFrequency, setSessionFrequency] = useState<'weekly' | 'biweekly' | 'monthly'>('weekly');
  const [noteType, setNoteType] = useState<'text' | 'audio'>('text');
  const [textNote, setTextNote] = useState('');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [hasExistingAudioNote, setHasExistingAudioNote] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  // Precargar datos del paciente cuando se abre el modal
  useEffect(() => {
    if (isOpen && patient) {
      // Precargar profesional si existe
      if (patient.professionalId) {
        setSelectedProfessional(patient.professionalId);
      } else {
        setSelectedProfessional('');
      }

      // Precargar estado
      if (patient.status) {
        setStatus(patient.status);
      }

      // Precargar frecuencia
      if (patient.sessionFrequency) {
        setSessionFrequency(patient.sessionFrequency);
      } else {
        setSessionFrequency('weekly');
      }

      // Precargar nota de texto si existe
      if (patient.textNote) {
        setTextNote(patient.textNote);
        setNoteType('text');
      } else {
        setTextNote('');
      }

      // Verificar si existe nota de voz
      if (patient.audioNote) {
        setHasExistingAudioNote(true);
        // Si hay audio pero no hay texto, mostrar audio como tipo seleccionado
        if (!patient.textNote) {
          setNoteType('audio');
        }
      } else {
        setHasExistingAudioNote(false);
      }

      // Resetear audio grabado (no precargamos el blob, solo indicamos existencia)
      setAudioBlob(null);
    } else if (!isOpen) {
      // Resetear estados cuando se cierra el modal
      setSelectedProfessional('');
      setStatus('active');
      setSessionFrequency('weekly');
      setNoteType('text');
      setTextNote('');
      setAudioBlob(null);
      setHasExistingAudioNote(false);
      chunksRef.current = [];
    }
  }, [isOpen, patient]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        chunksRef.current = [];
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast.error('No se pudo acceder al micrófono. Verifica los permisos del navegador.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (!patient) {
        toast.error('No se encontró el paciente');
        return;
      }

      const selectedProf = professionals.find(p => p.id == selectedProfessional);
      if (!selectedProf) {
        toast.error('Por favor selecciona un profesional');
        return;
      }

      // Construir payload dinámicamente, solo con campos que cambiaron
      const assignData: any = {
        patientId: patient.id,
        professionalId: selectedProfessional,
        professionalName: selectedProf.name,
      };

      // Solo enviar status si cambió
      if (status !== patient.status) {
        assignData.status = status;
      }

      // Solo enviar frecuencia si cambió
      if (sessionFrequency !== patient.sessionFrequency) {
        assignData.sessionFrequency = sessionFrequency;
      }

      // Manejar notas: solo enviar lo que el usuario está creando/editing en el tipo seleccionado
      // Si cambia de tipo, se reemplaza la nota anterior (no se preserva)
      
      const trimmedTextNote = textNote.trim();
      
      if (noteType === 'text') {
        // Modo texto: solo enviar texto si hay contenido
        if (trimmedTextNote) {
          assignData.textNote = trimmedTextNote;
        }
        // No enviar audio cuando se está en modo texto (se borra el audio existente)
      } else if (noteType === 'audio') {
        // Modo audio: solo enviar audio si se grabó uno nuevo
        if (audioBlob) {
          try {
            // Validar que el blob tenga datos
            if (audioBlob.size === 0) {
              toast.error('El audio grabado está vacío. Por favor, graba nuevamente.');
              return;
            }
            
            const audioFile = new File([audioBlob], 'note.webm', { 
              type: 'audio/webm'
            });
            
            console.log('Subiendo audio:', { size: audioFile.size, type: audioFile.type });
            const audioNoteUrl = await patientsService.uploadAudio(audioFile);
            console.log('Audio subido exitosamente:', audioNoteUrl);
            assignData.audioNote = audioNoteUrl;
          } catch (error: any) {
            console.error('Error al subir el audio:', error);
            const errorMessage = error?.message || 'Error al subir el audio';
            toast.error(errorMessage);
            return;
          }
        }
        // No enviar texto cuando se está en modo audio (se borra el texto existente)
      }

      // Solo actualizar assignedAt si es una nueva asignación (no tenía profesional antes)
      if (!patient.professionalId && selectedProfessional) {
        assignData.assignedAt = new Date().toISOString();
      }

      await onAssign(assignData as AssignPatientDTO);
      onClose();
      toast.success(patient.professionalId ? 'Asignación actualizada exitosamente' : 'Paciente asignado exitosamente');
    } catch (error) {
      console.error('Error al asignar paciente:', error);
      toast.error('Error al asignar el paciente');
    }
  };

  if (!isOpen) return null;

  const hasProfessional = patient?.professionalId ? true : false;
  const modalTitle = hasProfessional 
    ? `Editar asignación de ${patient?.name}`
    : `Asignar profesional a ${patient?.name}`;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            {modalTitle}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <span className="sr-only">Cerrar</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Profesional
            </label>
            <select
              value={selectedProfessional}
              onChange={(e) => setSelectedProfessional(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            >
              <option value="">Seleccionar profesional</option>
              {professionals.map((prof) => (
                <option key={prof.id} value={prof.id}>
                  {prof.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Estado
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'active' | 'pending' | 'inactive')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            >
              <option value="active">Activo</option>
              <option value="pending">Pendiente</option>
              <option value="inactive">Inactivo</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Frecuencia de Sesiones
            </label>
            <select
              value={sessionFrequency}
              onChange={(e) => setSessionFrequency(e.target.value as 'weekly' | 'biweekly' | 'monthly')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            >
              <option value="weekly">Semanal</option>
              <option value="biweekly">Quincenal</option>
              <option value="monthly">Mensual</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Tipo de Nota
            </label>
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => setNoteType('text')}
                className={`px-3 py-2 text-sm font-medium rounded-md ${
                  noteType === 'text'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Nota de Texto
              </button>
              <button
                type="button"
                onClick={() => setNoteType('audio')}
                className={`px-3 py-2 text-sm font-medium rounded-md ${
                  noteType === 'audio'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Nota de Voz
              </button>
            </div>
          </div>

          {noteType === 'text' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Nota de Texto
              </label>
              <textarea
                value={textNote}
                onChange={(e) => setTextNote(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                rows={4}
                placeholder="Escribe una nota sobre el paciente..."
              />
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Nota de Audio
              </label>
              {hasExistingAudioNote && !audioBlob && (
                <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-800">
                    ℹ️ Este paciente ya tiene una nota de voz cargada. Solo se reemplazará si grabas una nueva.
                  </p>
                </div>
              )}
              {!audioBlob ? (
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`w-full flex items-center justify-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium ${
                    isRecording
                      ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200'
                      : 'bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200'
                  }`}
                >
                  <MicrophoneIcon className="h-5 w-5 mr-2" />
                  {isRecording ? 'Detener Grabación' : 'Iniciar Grabación'}
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded-md">
                    <span className="text-sm text-gray-600">Audio grabado</span>
                    <button
                      type="button"
                      onClick={() => {
                        setAudioBlob(null);
                        chunksRef.current = [];
                      }}
                      className="text-red-600 hover:text-red-700"
                    >
                      Eliminar
                    </button>
                  </div>
                  {audioBlob && (
                    <audio
                      controls
                      src={URL.createObjectURL(audioBlob)}
                      className="w-full mt-2"
                      preload="metadata"
                    >
                      Tu navegador no soporta el elemento de audio.
                    </audio>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
            >
              {hasProfessional ? 'Guardar Cambios' : 'Asignar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ViewDescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient;
}

const ViewDescriptionModal: React.FC<ViewDescriptionModalProps> = ({ isOpen, onClose, patient }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Descripción del Paciente
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <span className="sr-only">Cerrar</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="mt-4">
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700">Nombre del Paciente</h4>
            <p className="mt-1 text-lg text-gray-900">{patient.name}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700">Descripción</h4>
            <div className="mt-2 p-4 bg-gray-50 rounded-lg">
              <p className="text-gray-900 whitespace-pre-wrap">{patient.description || 'No hay descripción disponible.'}</p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

interface StatusRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient;
  selectedStatusRequest: StatusRequest | null;
  onApprove: (response: string) => Promise<void>;
  onReject: (response: string) => Promise<void>;
}

const StatusRequestModal: React.FC<StatusRequestModalProps> = ({ 
  isOpen, 
  onClose, 
  patient, 
  selectedStatusRequest,
  onApprove, 
  onReject 
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (approve: boolean) => {
    setIsSubmitting(true);
    try {
      if (approve) {
        await onApprove(''); // No response needed for approval
      } else {
        await onReject(''); // No response needed for rejection
      }
      onClose();
    } catch (error) {
      console.error('Error al procesar solicitud:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Solicitud de Cambio de Estado
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {selectedStatusRequest?.type === 'activation'
                ? 'El profesional ha solicitado la activación del paciente'
                : patient.status === 'active' 
                  ? 'El profesional ha solicitado dar de baja a este paciente'
                  : 'El profesional ha solicitado reactivar a este paciente'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <span className="sr-only">Cerrar</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-6">
          <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
            <div className={`flex-shrink-0 w-12 h-12 ${
              patient.status === 'active' ? 'bg-primary/10' : 'bg-green-100'
            } rounded-full flex items-center justify-center`}>
              <ClockIcon className="h-6 w-6 text-gray-600" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-900">Detalles de la Solicitud</h4>
              <p className="text-lg font-semibold text-gray-900">{patient.name}</p>
              <p className="text-sm text-gray-500">
                Estado actual: <span className={`font-medium ${
                  patient.status === 'active' ? 'text-primary' :
                  patient.status === 'pending' ? 'text-yellow-700' :
                  patient.status === 'inactive' ? 'text-gray-700' :
                  'text-gray-700'
                }`}>
                  {patient.status === 'active' ? 'Activo' :
                   patient.status === 'pending' ? 'Pendiente' :
                   patient.status === 'inactive' ? 'Inactivo' :
                   'Inactivo'}
                </span>
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Razón del cambio: <span className="font-medium text-gray-900">{selectedStatusRequest?.reason || 'No se proporcionó razón'}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              Rechazar
            </button>
            <button
              onClick={() => handleSubmit(true)}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              Aprobar
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

interface NewPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, description: string) => Promise<void>;
}

const NewPatientModal: React.FC<NewPatientModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Por favor, ingresa el nombre del paciente');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(name, description);
      setName('');
      setDescription('');
      onClose();
    } catch (error) {
      console.error('Error al crear paciente:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Nuevo Paciente
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <span className="sr-only">Cerrar</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Nombre del Paciente
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Ingresa el nombre del paciente"
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Descripción
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Ingresa una descripción opcional"
            />
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creando...' : 'Crear Paciente'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

interface FrequencyRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient;
  request: FrequencyRequest;
  onApprove: (response: string) => Promise<void>;
  onReject: (response: string) => Promise<void>;
}

const FrequencyRequestModal: React.FC<FrequencyRequestModalProps> = ({ 
  isOpen, 
  onClose, 
  patient, 
  request,
  onApprove, 
  onReject 
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (approve: boolean) => {
    setIsSubmitting(true);
    try {
      if (approve) {
        await onApprove(''); // No response needed for approval
      } else {
        await onReject(''); // No response needed for rejection
      }
      onClose();
    } catch (error) {
      console.error('Error al procesar solicitud:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFrequencyLabel = (freq: string) => {
    switch (freq) {
      case 'weekly': return 'Semanal';
      case 'biweekly': return 'Quincenal';
      case 'monthly': return 'Mensual';
      default: return freq;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Solicitud de Cambio de Frecuencia
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              El profesional ha solicitado cambiar la frecuencia de sesiones para este paciente.
            </p>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <ClockIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-900">Detalles de la Solicitud</h4>
              <p className="text-lg font-semibold text-gray-900">{patient.name}</p>
              <p className="text-sm text-gray-500">
                Frecuencia actual: <span className="font-medium text-gray-900">
                  {getFrequencyLabel(request.currentFrequency)}
                </span>
              </p>
              <p className="text-sm text-gray-500">
                Frecuencia solicitada: <span className="font-medium text-blue-600">
                  {getFrequencyLabel(request.requestedFrequency)}
                </span>
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Razón del cambio: <span className="font-medium text-gray-900">{request.reason}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              Rechazar
            </button>
            <button
              onClick={() => handleSubmit(true)}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              Aprobar
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

const getFrequencyLabel = (freq: string | undefined) => {
  switch (freq) {
    case 'weekly': return 'Semanal';
    case 'biweekly': return 'Quincenal';
    case 'monthly': return 'Mensual';
    default: return 'No asignada';
  }
};

type PatientManagementStatus = 'all' | 'active' | 'pending' | 'inactive';

const PatientManagement = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isNewPatientModalOpen, setIsNewPatientModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isViewDescriptionModalOpen, setIsViewDescriptionModalOpen] = useState(false);
  const [patientToDelete, setPatientToDelete] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<PatientManagementStatus>('all');
  const [professionalFilter, setProfessionalFilter] = useState<string>('all');
  const [isStatusRequestModalOpen, setIsStatusRequestModalOpen] = useState(false);
  const [selectedStatusRequest, setSelectedStatusRequest] = useState<StatusRequest | null>(null);
  const [frequencyFilter, setFrequencyFilter] = useState<'all' | 'weekly' | 'biweekly' | 'monthly'>('all');
  const [isFrequencyModalOpen, setIsFrequencyModalOpen] = useState(false);
  const [selectedFrequencyRequest, setSelectedFrequencyRequest] = useState<FrequencyRequest | null>(null);
  const [isActivationRequestModalOpen, setIsActivationRequestModalOpen] = useState(false);
  const [selectedActivationRequest, setSelectedActivationRequest] = useState<StatusRequest | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    loadData();
  }, []);

  const openFrequencyRequestModal = useCallback(async (patient: Patient, requestId?: string) => {
    try {
      const requests = await frequencyRequestService.getPendingRequests();
      const targetRequest = requests.find((r) =>
        requestId ? String(r.id) === String(requestId) : r.patientId == patient.id
      );

      if (!targetRequest) {
        toast.error('La solicitud ya fue gestionada o no está disponible.');
        return;
      }

      setSelectedFrequencyRequest(targetRequest);
      setSelectedPatient(patient);
      setIsFrequencyModalOpen(true);
    } catch (error) {
      console.error('Error al obtener solicitud:', error);
      toast.error('Error al obtener la solicitud');
    }
  }, []);

  const openStatusRequestModal = useCallback(async (patient: Patient, requestId?: string) => {
    try {
      const requests = await statusRequestService.getPendingRequests();
      const targetRequest = requests.find((r) => {
        if (requestId) {
          return String(r.id) === String(requestId);
        }
        // Buscar solicitud de baja (inactive) que no sea de activación
        return r.patientId == patient.id && r.requestedStatus === 'inactive' && r.type !== 'activation';
      });

      if (!targetRequest) {
        toast.error('La solicitud ya fue gestionada o no está disponible.');
        return;
      }

      setSelectedStatusRequest(targetRequest);
      setSelectedPatient(patient);
      setIsStatusRequestModalOpen(true);
    } catch (error) {
      console.error('Error al obtener solicitud:', error);
      toast.error('Error al obtener la solicitud');
    }
  }, []);

  const openActivationRequestModal = useCallback(async (patient: Patient, requestId?: string) => {
    try {
      const requests = await statusRequestService.getPendingRequests();
      const targetRequest = requests.find((r) => {
        if (requestId) {
          return String(r.id) === String(requestId);
        }
        // Buscar solicitud de activación
        return r.patientId == patient.id && r.type === 'activation' && r.requestedStatus === 'active';
      });

      if (!targetRequest) {
        toast.error('La solicitud ya fue gestionada o no está disponible.');
        return;
      }

      setSelectedActivationRequest(targetRequest);
      setSelectedStatusRequest(targetRequest);
      setSelectedPatient(patient);
      setIsActivationRequestModalOpen(true);
    } catch (error) {
      console.error('Error al obtener solicitud:', error);
      toast.error('Error al obtener la solicitud');
    }
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const state = location.state as { openFrequencyRequest?: { patientId: string; requestId?: string } } | null;
    if (!state?.openFrequencyRequest) return;

    const { patientId, requestId } = state.openFrequencyRequest;
    const patient = patients.find((p) => String(p.id) === String(patientId));

    const finalize = () => navigate('.', { replace: true, state: {} });

    if (!patient) {
      toast.error('Paciente no encontrado para la solicitud.');
      finalize();
      return;
    }

    void openFrequencyRequestModal(patient, requestId).finally(finalize);
  }, [patients, location.state, isLoading, navigate, openFrequencyRequestModal]);

  useEffect(() => {
    if (isLoading) return;

    const state = location.state as { openStatusRequest?: { patientId: string; requestId?: string } } | null;
    if (!state?.openStatusRequest) return;

    const { patientId, requestId } = state.openStatusRequest;
    const patient = patients.find((p) => String(p.id) === String(patientId));

    const finalize = () => navigate('.', { replace: true, state: {} });

    if (!patient) {
      toast.error('Paciente no encontrado para la solicitud.');
      finalize();
      return;
    }

    void openStatusRequestModal(patient, requestId).finally(finalize);
  }, [patients, location.state, isLoading, navigate, openStatusRequestModal]);

  useEffect(() => {
    if (isLoading) return;

    const state = location.state as { openActivationRequest?: { patientId: string; requestId?: string } } | null;
    if (!state?.openActivationRequest) return;

    const { patientId, requestId } = state.openActivationRequest;
    const patient = patients.find((p) => String(p.id) === String(patientId));

    const finalize = () => navigate('.', { replace: true, state: {} });

    if (!patient) {
      toast.error('Paciente no encontrado para la solicitud.');
      finalize();
      return;
    }

    void openActivationRequestModal(patient, requestId).finally(finalize);
  }, [patients, location.state, isLoading, navigate, openActivationRequestModal]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [patientsData, usersData] = await Promise.all([
        patientsService.getAllPatients(),
        userService.getUsers()
      ]);
      
      setPatients(patientsData);
      
      // Filtrar solo los usuarios con rol de profesional (psicólogo)
      const psychologists = usersData
        .filter(user => user.role === 'professional' && user.status === 'active')
        .map(user => ({
          id: user.id,
          name: user.name
        }));
      setProfessionals(psychologists);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar los datos');
      setPatients([]);
      setProfessionals([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssign = async (assignData: AssignPatientDTO) => {
    try {
      const updatedPatient = await patientsService.assignPatient(assignData);
      setPatients(patients.map(p => p.id === updatedPatient.id ? updatedPatient : p));
      setIsAssignModalOpen(false);
      setSelectedPatient(null);
      toast.success('Paciente asignado correctamente');
    } catch (error) {
      console.error('Error al asignar paciente:', error);
      toast.error('Error al asignar el paciente');
    }
  };

  const openAssignModal = (patient: Patient) => {
    setSelectedPatient(patient);
    setIsAssignModalOpen(true);
  };

  const handleAddPatient = async (name: string, description: string) => {
    try {
      const newPatient: CreatePatientDTO = {
        name,
        description
      };
      await patientsService.addPatient(newPatient);
      await loadData();
      toast.success('Paciente agregado exitosamente');
    } catch (error) {
      console.error('Error al agregar paciente:', error);
      toast.error('Error al agregar el paciente');
      throw error;
    }
  };


  const confirmDelete = async () => {
    if (!patientToDelete) return;
    
    try {
      await patientsService.deletePatient(patientToDelete);
      setPatients(patients.filter(p => p.id !== patientToDelete));
      toast.success('Paciente eliminado exitosamente');
      setIsDeleteModalOpen(false);
      setPatientToDelete(null);
    } catch (error) {
      console.error('Error al eliminar paciente:', error);
      toast.error('Error al eliminar el paciente');
    }
  };

  const openViewDescriptionModal = (patient: Patient) => {
    setSelectedPatient(patient);
    setIsViewDescriptionModalOpen(true);
  };

  const handleViewStatusRequest = async (patient: Patient) => {
    try {
      const requests = await statusRequestService.getPendingRequests();
      const request = requests.find(r => r.patientId == patient.id && r.requestedStatus == 'inactive' && r.type != 'activation');
      if (request) {
        setSelectedStatusRequest(request);
        setSelectedPatient(patient);
        setIsStatusRequestModalOpen(true);
      } else {
        toast.error('No hay solicitudes de inactivación pendientes para este paciente');
      }
    } catch (error) {
      console.error('Error al obtener solicitud:', error);
      toast.error('Error al obtener la solicitud');
    }
  };

  const handleApproveRequest = async (response: string) => {
    if (!selectedStatusRequest) return;
    try {
      await statusRequestService.approveRequest(selectedStatusRequest.id, response);
      await loadData(); // Recargar datos
      if (selectedStatusRequest.type === 'activation') {
        toast.success('El paciente fue activado correctamente');
      } else {
        toast.success('Solicitud aprobada correctamente');
      }
    } catch (error) {
      console.error('Error al aprobar solicitud:', error);
      toast.error('Error al aprobar la solicitud');
    }
  };

  const handleRejectRequest = async (response: string) => {
    if (!selectedStatusRequest) return;
    try {
      await statusRequestService.rejectRequest(String(selectedStatusRequest.id), response);
      await loadData(); // Recargar datos
      toast.success('Solicitud rechazada correctamente');
    } catch (error) {
      console.error('Error al rechazar solicitud:', error);
      toast.error('Error al rechazar la solicitud');
    }
  };

  const handleViewMedicalHistory = (patient: Patient) => {
    navigate(`/admin/medical-history/${patient.id}`);
  };

  const handleViewFrequencyRequest = async (patient: Patient) => {
    await openFrequencyRequestModal(patient);
  };

  const handleApproveFrequencyRequest = async (response: string) => {
    if (!selectedFrequencyRequest) return;
    try {
      await frequencyRequestService.approveRequest(selectedFrequencyRequest.id, response);
      await loadData(); // Recargar datos
      toast.success('Solicitud aprobada correctamente');
    } catch (error) {
      console.error('Error al aprobar solicitud:', error);
      toast.error('Error al aprobar la solicitud');
    }
  };

  const handleRejectFrequencyRequest = async (response: string) => {
    if (!selectedFrequencyRequest) return;
    try {
      await frequencyRequestService.rejectRequest(selectedFrequencyRequest.id, response || 'Rechazado por el administrador');
      await loadData(); // Recargar datos
      toast.success('Solicitud rechazada correctamente');
    } catch (error) {
      console.error('Error al rechazar solicitud:', error);
      toast.error('Error al rechazar la solicitud');
    }
  };

  const handleViewActivationRequest = async (patient: Patient) => {
    try {
      const requests = await statusRequestService.getPendingRequests();
      const request = requests.find(r => r.patientId == patient.id && r.type === 'activation' && r.requestedStatus === 'active');
      if (request) {
        setSelectedActivationRequest(request);
        setSelectedStatusRequest(request);
        setSelectedPatient(patient);
        setIsActivationRequestModalOpen(true);
      } else {
        toast.error('No hay solicitudes de activación pendientes para este paciente');
      }
    } catch (error) {
      console.error('Error al obtener solicitud de activación:', error);
      toast.error('Error al obtener la solicitud de activación');
    }
  };

  const filteredPatients = patients.filter(patient => {
    const matchesSearch = patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (patient.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || patient.status === statusFilter;
    const matchesProfessional = professionalFilter === 'all' || patient.professionalId === professionalFilter;
    const matchesFrequency = frequencyFilter === 'all' || patient.sessionFrequency === frequencyFilter;
    
    return matchesSearch && matchesStatus && matchesProfessional && matchesFrequency;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="md:flex md:items-center md:justify-between mb-6">
          <button
              onClick={() => navigate('/admin')}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              Volver al Dashboard
            </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
              Gestión de Pacientes
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Administra los pacientes y sus asignaciones
            </p>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <button
              onClick={() => setIsNewPatientModalOpen(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Nuevo Paciente
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar pacientes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as PatientManagementStatus)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-lg"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="pending">Pendientes</option>
              <option value="inactive">Inactivos</option>
            </select>
          </div>

          <div>
            <select
              value={professionalFilter}
              onChange={(e) => setProfessionalFilter(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-lg"
            >
              <option value="all">Todos los profesionales</option>
              {professionals.map((prof) => (
                <option key={prof.id} value={prof.id}>
                  {prof.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={frequencyFilter}
              onChange={(e) => setFrequencyFilter(e.target.value as 'all' | 'weekly' | 'biweekly' | 'monthly')}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-lg"
            >
              <option value="all">Todas las frecuencias</option>
              <option value="weekly">Semanal</option>
              <option value="biweekly">Quincenal</option>
              <option value="monthly">Mensual</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-sm text-gray-600">
            Mostrando {filteredPatients.length} de {patients.length} pacientes
          </span>
          {searchTerm && (
            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm">
              Búsqueda: {searchTerm}
            </span>
          )}
          {statusFilter !== 'all' && (
            <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm">
              Estado: {
                statusFilter === 'active' ? 'Activo' :
                statusFilter === 'pending' ? 'Pendiente' :
                statusFilter === 'inactive' ? 'Inactivo' :
                'Todos'
              }
            </span>
          )}
          {professionalFilter !== 'all' && (
            <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-sm">
              Profesional: {professionals.find(p => String(p.id) === String(professionalFilter))?.name || 'No encontrado'}
            </span>
          )}
          {frequencyFilter !== 'all' && (
            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm">
              Frecuencia: {getFrequencyLabel(frequencyFilter)}
            </span>
          )}
        </div>

        <div className="block md:hidden bg-white rounded-lg shadow px-4 py-4">
          <div className="space-y-3">
            {filteredPatients.map((patient) => {
              const statusClass =
                patient.status === 'active'   ? 'bg-green-100 text-green-800' :
                patient.status === 'pending'  ? 'bg-yellow-100 text-yellow-800' :
                patient.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                                                'bg-gray-100 text-gray-800';

              const statusLabel =
                patient.status === 'active'   ? 'Activo' :
                patient.status === 'pending'  ? 'Pendiente' :
                patient.status === 'inactive' ? 'Inactivo' :
                                                'Inactivo';

              return (
                <div key={patient.id} className="rounded-lg border border-gray-200 p-4">
                  {/* Nombre + Estado */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-base font-semibold text-gray-900 truncate">
                        {patient.name}
                      </div>
                      <div className="text-sm text-gray-700">
                        Profesional: <span className="font-medium">
                          {patient.professionalName || 'No asignado'}
                        </span>
                      </div>
                    </div>
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}`}>
                      {statusLabel}
                    </span>
                  </div>

                  {/* Frecuencia */}
                  <div className="mt-3">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      patient.sessionFrequency ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {getFrequencyLabel(patient.sessionFrequency)}
                    </span>
                  </div>

                  {/* Acciones (mismas que la tabla) */}
                  <div className="mt-3 flex flex-wrap justify-end gap-3">
                    <button
                      onClick={() => handleViewMedicalHistory(patient)}
                      className="text-blue-600 hover:text-blue-900"
                      title="Ver Historial Médico"
                    >
                      <DocumentTextIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => openViewDescriptionModal(patient)}
                      className="text-gray-600 hover:text-gray-900"
                      title="Ver Descripción"
                    >
                      <EyeIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => openAssignModal(patient)}
                      className="text-green-600 hover:text-green-900"
                      title="Asignar Profesional"
                    >
                      <UserPlusIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleViewStatusRequest(patient)}
                      className="text-yellow-600 hover:text-yellow-900"
                      title="Ver Solicitud"
                    >
                      <BellIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleViewFrequencyRequest(patient)}
                      className="text-blue-600 hover:text-blue-900"
                      title="Ver Solicitud de Frecuencia"
                    >
                      <ClockIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleViewActivationRequest(patient)}
                      className="text-green-600 hover:text-green-900"
                      title="Ver Solicitud de Activación"
                    >
                      <ArrowUpCircleIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => { setPatientToDelete(patient.id); setIsDeleteModalOpen(true); }}
                      className="text-red-600 hover:text-red-900"
                      title="Eliminar"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="hidden md:block bg-white rounded-lg shadow px-5 py-6 sm:px-6">
          <div className="flex flex-col">
            <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
              <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
                <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Nombre
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Estado
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Profesional
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Frecuencia
                        </th>
                        <th scope="col" className="relative px-6 py-3">
                          <span className="sr-only">Acciones</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredPatients.map((patient) => (
                        <tr key={patient.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{patient.name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              patient.status === 'active' ? 'bg-green-100 text-green-800' :
                              patient.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              patient.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {patient.status === 'active' ? 'Activo' :
                               patient.status === 'pending' ? 'Pendiente' :
                               patient.status === 'inactive' ? 'Inactivo' :
                               'Inactivo'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{patient.professionalName || 'No asignado'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              patient.sessionFrequency ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {getFrequencyLabel(patient.sessionFrequency)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                            <button
                              onClick={() => handleViewMedicalHistory(patient)}
                              className="text-blue-600 hover:text-blue-900"
                              title="Ver Historial Médico"
                            >
                              <DocumentTextIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => openViewDescriptionModal(patient)}
                              className="text-gray-600 hover:text-gray-900"
                              title="Ver Descripción"
                            >
                              <EyeIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => openAssignModal(patient)}
                              className="text-green-600 hover:text-green-900"
                              title="Asignar Profesional"
                            >
                              <UserPlusIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleViewStatusRequest(patient)}
                              className="text-yellow-600 hover:text-yellow-900"
                              title="Ver Solicitud"
                            >
                              <BellIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleViewFrequencyRequest(patient)}
                              className="text-blue-600 hover:text-blue-900"
                              title="Ver Solicitud de Frecuencia"
                            >
                              <ClockIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleViewActivationRequest(patient)}
                              className="text-green-600 hover:text-green-900"
                              title="Ver Solicitud de Activación"
                            >
                              <ArrowUpCircleIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => {
                                setPatientToDelete(patient.id);
                                setIsDeleteModalOpen(true);
                              }}
                              className="text-red-600 hover:text-red-900"
                              title="Eliminar"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <NewPatientModal
        isOpen={isNewPatientModalOpen}
        onClose={() => setIsNewPatientModalOpen(false)}
        onSubmit={handleAddPatient}
      />

      {isDeleteModalOpen && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <TrashIcon className="h-6 w-6 text-red-600" aria-hidden="true" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Eliminar Paciente
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        ¿Estás seguro de que deseas eliminar este paciente? Esta acción no se puede deshacer.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Eliminar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setPatientToDelete(null);
                  }}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAssignModalOpen && selectedPatient && (
        <AssignModal
          isOpen={isAssignModalOpen}
          onClose={() => {
            setIsAssignModalOpen(false);
            setSelectedPatient(null);
          }}
          onAssign={handleAssign}
          patient={selectedPatient}
          professionals={professionals}
        />
      )}

      {isViewDescriptionModalOpen && selectedPatient && (
        <ViewDescriptionModal
          isOpen={isViewDescriptionModalOpen}
          onClose={() => {
            setIsViewDescriptionModalOpen(false);
            setSelectedPatient(null);
          }}
          patient={selectedPatient}
        />
      )}

      {selectedPatient && isStatusRequestModalOpen && (
        <StatusRequestModal
          isOpen={isStatusRequestModalOpen}
          onClose={() => {
            setIsStatusRequestModalOpen(false);
            setSelectedPatient(null);
            setSelectedStatusRequest(null);
          }}
          patient={selectedPatient}
          selectedStatusRequest={selectedStatusRequest}
          onApprove={handleApproveRequest}
          onReject={handleRejectRequest}
        />
      )}

      {selectedPatient && selectedFrequencyRequest && (
        <FrequencyRequestModal
          isOpen={isFrequencyModalOpen}
          onClose={() => {
            setIsFrequencyModalOpen(false);
            setSelectedPatient(null);
            setSelectedFrequencyRequest(null);
          }}
          patient={selectedPatient}
          request={selectedFrequencyRequest}
          onApprove={handleApproveFrequencyRequest}
          onReject={handleRejectFrequencyRequest}
        />
      )}

      {selectedPatient && isActivationRequestModalOpen && selectedActivationRequest && (
        <StatusRequestModal
          isOpen={isActivationRequestModalOpen}
          onClose={() => {
            setIsActivationRequestModalOpen(false);
            setSelectedPatient(null);
            setSelectedActivationRequest(null);
          }}
          patient={selectedPatient}
          selectedStatusRequest={selectedActivationRequest}
          onApprove={handleApproveRequest}
          onReject={handleRejectRequest}
        />
      )}
    </div>
  );
};

export default PatientManagement; 