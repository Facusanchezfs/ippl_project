import React, { useState, useEffect, useCallback } from 'react';
import { PlusIcon, TrashIcon, EyeIcon, ClockIcon, DocumentTextIcon, BellIcon, MagnifyingGlassIcon, ArrowUpCircleIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import patientsService, { CreatePatientDTO } from '../../services/patients.service';
import { Patient } from '../../types/Patient';
import userService from '../../services/user.service';
import statusRequestService from '../../services/statusRequest.service';
import { StatusRequest } from '../../types/StatusRequest';
import toast from 'react-hot-toast';
import Modal from '../Modal';
import { useNavigate, useLocation } from 'react-router-dom';
import frequencyRequestService, { FrequencyRequest } from '../../services/frequencyRequest.service';
import appointmentsService from '../../services/appointments.service';
import recurringAppointmentsService from '../../services/recurringAppointments.service';
import AudioRecorder from '../AudioRecorder';

interface Professional {
  id: string;
  name: string;
}

// AssignModal eliminado: la asignación y notas se gestionan ahora desde ViewDescriptionModal y NewPatientModal.

interface ViewDescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient;
  professionals: Professional[];
  onUpdatePatient: (id: string, data: any) => Promise<void>;
  onScheduleUpdated: () => Promise<void>;
}

const ViewDescriptionModal: React.FC<ViewDescriptionModalProps> = ({
  isOpen,
  onClose,
  patient,
  professionals,
  onUpdatePatient,
  onScheduleUpdated,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [status, setStatus] = useState<Patient['status']>(patient.status);
  const [professionalId, setProfessionalId] = useState<string | undefined>(patient.professionalId);
  const [isSaving, setIsSaving] = useState(false);
  const [textNote, setTextNote] = useState(patient.textNote || '');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [hasExistingAudioNote, setHasExistingAudioNote] = useState(!!patient.audioNote);

  // Estado de agenda recurrente
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [isScheduleEditing, setIsScheduleEditing] = useState(false);
  const [scheduleRecurringId, setScheduleRecurringId] = useState<string | null>(null);
  const [scheduleGroupId, setScheduleGroupId] = useState<string | null>(null);
  const [scheduleMode, setScheduleMode] = useState<'single' | 'group' | ''>('');
  const [scheduleFrequency, setScheduleFrequency] = useState<'weekly' | 'biweekly' | 'monthly' | 'twice_weekly' | ''>('');
  const [scheduleSingle, setScheduleSingle] = useState<{
    nextDate: string;
    startTime: string;
    duration: 30 | 60;
    sessionCost: number | '';
  }>({
    nextDate: '',
    startTime: '',
    duration: 60,
    sessionCost: '',
  });
  const [scheduleEntries, setScheduleEntries] = useState<
    Array<{
      recurringId: string | null;
      nextDate: string;
      startTime: string;
      duration: 30 | 60;
      sessionCost: number | '';
    }>
  >([]);

  // Mantener el estado local sincronizado cuando cambia el paciente en props
  useEffect(() => {
    setStatus(patient.status);
    setProfessionalId(patient.professionalId);
    setTextNote(patient.textNote || '');
    setHasExistingAudioNote(!!patient.audioNote);
    setAudioBlob(null);
  }, [patient]);

  // Cargar agenda recurrente al abrir modal
  useEffect(() => {
    const loadSchedule = async () => {
      if (!isOpen) return;
      setScheduleLoading(true);
      setScheduleError(null);
      try {
        const data =
          await recurringAppointmentsService.getPatientRecurringScheduleAdmin(
            patient.id
          );

        if (data) {
          setScheduleMode(data.mode);
          setScheduleFrequency(data.frequency);

          if (data.mode === 'single') {
            setScheduleRecurringId(String(data.recurringId));
            setScheduleGroupId(null);
            setScheduleSingle({
              nextDate: data.nextDate,
              startTime: data.startTime,
              duration: data.duration === 30 ? 30 : 60,
              sessionCost:
                typeof data.sessionCost === 'number' ? data.sessionCost : 0,
            });
            setScheduleEntries([]);
          } else {
            setScheduleRecurringId(null);
            setScheduleGroupId(data.groupId);
            setScheduleEntries(
              data.entries.map((entry) => ({
                recurringId: String(entry.recurringId),
                nextDate: entry.nextDate,
                startTime: entry.startTime,
                duration: entry.duration === 30 ? 30 : 60,
                sessionCost:
                  typeof entry.sessionCost === 'number' ? entry.sessionCost : 0,
              }))
            );
          }
        } else {
          // El paciente no tiene agenda recurrente configurada todavía
          setScheduleRecurringId(null);
          setScheduleGroupId(null);
          setScheduleMode('');
          setScheduleFrequency('');
          setScheduleSingle({
            nextDate: '',
            startTime: '',
            duration: 60,
            sessionCost: '',
          });
          setScheduleEntries([]);
        }
      } catch (error: any) {
        console.error('Error al cargar agenda recurrente:', error);
        setScheduleError(
          error?.response?.data?.message ||
            'No se pudo cargar la agenda recurrente del paciente'
        );
      } finally {
        setScheduleLoading(false);
      }
    };

    void loadSchedule();
  }, [isOpen, patient.id]);

  const effectivePatientStatus = isEditing ? status : patient.status;
  const scheduleBlockedForInactive = effectivePatientStatus === 'inactive';

  const handleCancelEdit = () => {
    setIsEditing(false);
    setStatus(patient.status);
    setProfessionalId(patient.professionalId);
    setTextNote(patient.textNote || '');
    setHasExistingAudioNote(!!patient.audioNote);
    setAudioBlob(null);
  };

  const handleSave = async () => {
    const payload: any = {};

    if (status !== patient.status) {
      payload.status = status;
    }

    if (professionalId && professionalId !== patient.professionalId) {
      const selectedProf = professionals.find((p) => String(p.id) === String(professionalId));
      payload.professionalId = professionalId;
      if (selectedProf) {
        payload.professionalName = selectedProf.name;
      }
    }

    const trimmedTextNote = textNote.trim();
    if (trimmedTextNote !== (patient.textNote || '')) {
      payload.textNote = trimmedTextNote || null;
    }

    // Manejar nota de audio
    if (audioBlob) {
      if (audioBlob.size === 0) {
        toast.error('El audio grabado está vacío. Por favor, graba nuevamente.');
        return;
      }
      try {
        const audioFile = new File([audioBlob], 'note.webm', {
          type: 'audio/webm',
        });
        const audioNoteUrl = await patientsService.uploadAudio(audioFile);
        payload.audioNote = audioNoteUrl;
      } catch (error: any) {
        console.error('Error al subir el audio:', error);
        const errorMessage = error?.message || 'Error al subir el audio';
        toast.error(errorMessage);
        return;
      }
    } else if (patient.audioNote && hasExistingAudioNote) {
      // Preservar audio existente si no se grabó uno nuevo
      payload.audioNote = patient.audioNote;
    } else if (!hasExistingAudioNote && patient.audioNote) {
      // Si se indicó eliminar el audio existente
      payload.audioNote = null;
    }

    // Si no hay cambios, no llamar a la API
    if (Object.keys(payload).length === 0) {
      setIsEditing(false);
      return;
    }

    try {
      setIsSaving(true);
      await onUpdatePatient(patient.id, payload);
      setIsEditing(false);
    } catch (error) {
      console.error('Error al actualizar paciente:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSchedule = async () => {
    if (scheduleBlockedForInactive) {
      toast.error(
        'No se puede guardar la agenda mientras el paciente está inactivo. Activá al paciente y guardá los datos primero.'
      );
      return;
    }

    // Caso grupo twice_weekly
    if (scheduleMode === 'group') {
      if (scheduleEntries.length !== 2) {
        setScheduleError('Debes completar ambos bloques de la agenda.');
        return;
      }

      for (const entry of scheduleEntries) {
        if (
          !entry.nextDate ||
          !entry.startTime ||
          !entry.duration ||
          entry.sessionCost === ''
        ) {
          setScheduleError(
            'Debes completar fecha, hora, duración y costo en ambos bloques.'
          );
          return;
        }
      }

      try {
        setScheduleLoading(true);
        await recurringAppointmentsService.updateRecurringAppointmentGroupAdmin(
          scheduleGroupId!,
          {
            entries: scheduleEntries.map((entry) => ({
              recurringId: entry.recurringId!,
              nextDate: entry.nextDate,
              startTime: entry.startTime,
              duration: entry.duration,
              sessionCost: Number(entry.sessionCost),
            })),
          }
        );
        setIsScheduleEditing(false);
        await onScheduleUpdated();
      } catch (error: any) {
        console.error('Error al actualizar agenda recurrente (grupo):', error);
        setScheduleError(
          error?.response?.data?.message ||
            'Error al actualizar la agenda recurrente'
        );
      } finally {
        setScheduleLoading(false);
      }
      return;
    }

    // Validaciones frontend para modo single
    if (scheduleSingle.duration !== 30 && scheduleSingle.duration !== 60) {
      setScheduleError('La duración debe ser 30 o 60 minutos.');
      return;
    }

    if (
      scheduleSingle.sessionCost === '' ||
      Number(scheduleSingle.sessionCost) < 0
    ) {
      setScheduleError('El costo de sesión debe ser mayor o igual a 0.');
      return;
    }

    if (!scheduleSingle.nextDate) {
      setScheduleError('Debes especificar la fecha de la próxima cita.');
      return;
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    if (scheduleSingle.nextDate < todayStr) {
      setScheduleError(
        'La fecha de la próxima cita no puede estar en el pasado.'
      );
      return;
    }

    if (!/^\d{2}:\d{2}$/.test(scheduleSingle.startTime)) {
      setScheduleError('La hora de inicio debe estar en formato HH:MM.');
      return;
    }

    try {
      setScheduleLoading(true);

      if (!scheduleRecurringId) {
        // Crear nueva agenda recurrente para el paciente
        await recurringAppointmentsService.createPatientRecurringScheduleAdmin(
          patient.id,
          {
            frequency: (scheduleFrequency ||
              'weekly') as 'weekly' | 'biweekly' | 'monthly',
            nextDate: scheduleSingle.nextDate,
            startTime: scheduleSingle.startTime,
            duration: scheduleSingle.duration,
            sessionCost: Number(scheduleSingle.sessionCost),
          }
        );
      } else {
        // Actualizar agenda existente
        await recurringAppointmentsService.updateRecurringAppointmentAdmin(
          scheduleRecurringId,
          {
            frequency: (scheduleFrequency ||
              'weekly') as 'weekly' | 'biweekly' | 'monthly',
            nextDate: scheduleSingle.nextDate,
            startTime: scheduleSingle.startTime,
            duration: scheduleSingle.duration,
            sessionCost: Number(scheduleSingle.sessionCost),
          }
        );
      }

      setIsScheduleEditing(false);
      await onScheduleUpdated();
    } catch (error: any) {
      console.error('Error al actualizar agenda recurrente:', error);
      setScheduleError(
        error?.response?.data?.message ||
          'Error al actualizar la agenda recurrente'
      );
    } finally {
      setScheduleLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Detalle del Paciente
          </h3>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Nombre
            </label>
            <p className="mt-1 text-lg text-gray-900">{patient.name}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Estado
            </label>
            {isEditing ? (
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as 'active' | 'pending' | 'inactive')
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
              >
                <option value="active">Activo</option>
                <option value="pending">Pendiente</option>
                <option value="inactive">Inactivo</option>
              </select>
            ) : (
              <span
                className={`mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  patient.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : patient.status === 'pending'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {patient.status === 'active'
                  ? 'Activo'
                  : patient.status === 'pending'
                  ? 'Pendiente'
                  : 'Inactivo'}
              </span>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Profesional
            </label>
            {isEditing ? (
              <select
                value={professionalId || ''}
                onChange={(e) =>
                  setProfessionalId(e.target.value || undefined)
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
              >
                <option value="">No asignado</option>
                {professionals.map((prof) => (
                  <option key={prof.id} value={prof.id}>
                    {prof.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="mt-1 text-sm text-gray-900">
                {patient.professionalName || 'No asignado'}
              </p>
            )}
          </div>


          <div>
            <label className="block text-sm font-medium text-gray-700">
              Costo de la sesión
            </label>
            <p className="mt-1 text-sm text-gray-900">
              {typeof patient.sessionCost === 'number'
                ? `$${patient.sessionCost.toFixed(2)}`
                : 'No informado'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Nota de texto
            </label>
            {isEditing ? (
              <textarea
                value={textNote}
                onChange={(e) => setTextNote(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm resize-none"
                rows={4}
                placeholder="Escribe una nota sobre el paciente..."
              />
            ) : (
              <div className="mt-1 p-3 bg-gray-50 rounded-lg max-h-40 overflow-y-auto">
                <p className="text-sm text-gray-900 whitespace-pre-wrap">
                  {patient.textNote || 'Sin nota de texto.'}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Nota de audio
            </label>

            {hasExistingAudioNote && patient.audioNote && !audioBlob && (
              <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-xs text-blue-800">
                  ℹ️ Este paciente ya tiene una nota de voz cargada. Solo se reemplazará si
                  grabas una nueva.
                </p>
              </div>
            )}

            {isEditing ? (
              <AudioRecorder
                showLabel={false}
                existingAudioUrl={patient.audioNote || undefined}
                onRecordingComplete={(blob) => {
                  setAudioBlob(blob);
                  setHasExistingAudioNote(false);
                }}
              />
            ) : patient.audioNote ? (
              <audio
                controls
                src={patient.audioNote}
                className="w-full mt-1"
                preload="metadata"
              >
                Tu navegador no soporta el elemento de audio.
              </audio>
            ) : (
              <p className="text-sm text-gray-500">Sin nota de audio.</p>
            )}
          </div>
        </div>

        {/* Sección de agenda recurrente */}
        <div className="mt-8 border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-800">
              Agenda recurrente
            </h4>
            {!scheduleLoading && !isScheduleEditing && (
              <button
                type="button"
                disabled={scheduleBlockedForInactive}
                title={
                  scheduleBlockedForInactive
                    ? 'Activá al paciente y guardá los datos para gestionar la agenda'
                    : undefined
                }
                onClick={() => {
                  if (!scheduleRecurringId && !scheduleGroupId) {
                    setScheduleFrequency(
                      (patient.sessionFrequency as
                        | 'weekly'
                        | 'biweekly'
                        | 'monthly'
                        | 'twice_weekly') || 'weekly'
                    );
                    setScheduleSingle({
                      nextDate: '',
                      startTime: '',
                      duration: 60,
                      sessionCost: '',
                    });
                    setScheduleEntries([]);
                    setScheduleMode('');
                  }
                  setIsScheduleEditing(true);
                  setScheduleError(null);
                }}
                className={`text-xs font-medium ${
                  scheduleBlockedForInactive
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-blue-600 hover:text-blue-700'
                }`}
              >
                {scheduleRecurringId ? 'Editar agenda' : 'Crear agenda'}
              </button>
            )}
          </div>

          {scheduleLoading && (
            <p className="text-sm text-gray-500">Cargando agenda...</p>
          )}

          {scheduleError && !scheduleLoading && (
            <p className="text-sm text-red-600 mb-2">{scheduleError}</p>
          )}

          {scheduleBlockedForInactive && !scheduleLoading && (
            <p className="text-sm text-amber-700 mb-2">
              Con el paciente inactivo no se puede crear ni editar la agenda recurrente. Cambiá el estado a
              Activo o Pendiente y guardá los datos antes de configurar la agenda.
            </p>
          )}

          {!scheduleLoading && (scheduleRecurringId || scheduleGroupId || isScheduleEditing) && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Frecuencia
                </label>
                <select
                  disabled={!isScheduleEditing}
                  value={scheduleFrequency}
                  onChange={(e) =>
                    setScheduleFrequency(
                      e.target.value as
                        | 'weekly'
                        | 'biweekly'
                        | 'monthly'
                        | 'twice_weekly'
                        | ''
                    )
                  }
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm disabled:bg-gray-100 disabled:text-gray-500"
                >
                  <option value="weekly">Semanal</option>
                  <option value="biweekly">Quincenal</option>
                  <option value="monthly">Mensual</option>
                  <option value="twice_weekly">2 veces por semana</option>
                </select>
              </div>

              {scheduleMode !== 'group' && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Próxima fecha
                      </label>
                      <input
                        type="date"
                        disabled={!isScheduleEditing}
                        value={scheduleSingle.nextDate}
                        onChange={(e) =>
                          setScheduleSingle((prev) => ({
                            ...prev,
                            nextDate: e.target.value,
                          }))
                        }
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm disabled:bg-gray-100 disabled:text-gray-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Hora inicio
                      </label>
                      <input
                        type="time"
                        disabled={!isScheduleEditing}
                        value={scheduleSingle.startTime}
                        onChange={(e) =>
                          setScheduleSingle((prev) => ({
                            ...prev,
                            startTime: e.target.value,
                          }))
                        }
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm disabled:bg-gray-100 disabled:text-gray-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Duración
                      </label>
                      <select
                        disabled={!isScheduleEditing}
                        value={scheduleSingle.duration}
                        onChange={(e) =>
                          setScheduleSingle((prev) => ({
                            ...prev,
                            duration:
                              Number(e.target.value) === 30 ? 30 : 60,
                          }))
                        }
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm disabled:bg-gray-100 disabled:text-gray-500"
                      >
                        <option value={30}>30 minutos</option>
                        <option value={60}>60 minutos</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Costo sesión
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">$</span>
                      </div>
                      <input
                        type="number"
                        disabled={!isScheduleEditing}
                        value={scheduleSingle.sessionCost}
                        onChange={(e) =>
                          setScheduleSingle((prev) => ({
                            ...prev,
                            sessionCost:
                              e.target.value === ''
                                ? ''
                                : Number(e.target.value),
                          }))
                        }
                        onWheel={(e) => e.currentTarget.blur()}
                        className="pl-7 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm disabled:bg-gray-100 disabled:text-gray-500"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                </>
              )}

              {scheduleMode === 'group' && (
                <div className="space-y-4">
                  {/* Bloque A */}
                  <div className="border rounded-lg p-3">
                    <h5 className="text-xs font-semibold text-gray-600 mb-2">
                      Bloque A
                    </h5>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Próxima fecha
                        </label>
                        <input
                          type="date"
                          disabled={!isScheduleEditing}
                          value={scheduleEntries[0]?.nextDate || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            setScheduleEntries((prev) => {
                              const next = [...prev];
                              next[0] = {
                                ...(next[0] || {
                                  recurringId: null,
                                  nextDate: '',
                                  startTime: '',
                                  duration: 60 as 30 | 60,
                                  sessionCost: '',
                                }),
                                nextDate: value,
                              };
                              return next;
                            });
                          }}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm disabled:bg-gray-100 disabled:text-gray-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Hora inicio
                        </label>
                        <input
                          type="time"
                          disabled={!isScheduleEditing}
                          value={scheduleEntries[0]?.startTime || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            setScheduleEntries((prev) => {
                              const next = [...prev];
                              next[0] = {
                                ...(next[0] || {
                                  recurringId: null,
                                  nextDate: '',
                                  startTime: '',
                                  duration: 60 as 30 | 60,
                                  sessionCost: '',
                                }),
                                startTime: value,
                              };
                              return next;
                            });
                          }}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm disabled:bg-gray-100 disabled:text-gray-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Duración
                        </label>
                        <select
                          disabled={!isScheduleEditing}
                          value={scheduleEntries[0]?.duration ?? 60}
                          onChange={(e) => {
                            const value =
                              Number(e.target.value) === 30 ? 30 : 60;
                            setScheduleEntries((prev) => {
                              const next = [...prev];
                              next[0] = {
                                ...(next[0] || {
                                  recurringId: null,
                                  nextDate: '',
                                  startTime: '',
                                  duration: 60 as 30 | 60,
                                  sessionCost: '',
                                }),
                                duration: value,
                              };
                              return next;
                            });
                          }}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm disabled:bg-gray-100 disabled:text-gray-500"
                        >
                          <option value={30}>30 minutos</option>
                          <option value={60}>60 minutos</option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700">
                        Costo sesión
                      </label>
                      <div className="mt-1 relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 sm:text-sm">
                            $
                          </span>
                        </div>
                        <input
                          type="number"
                          disabled={!isScheduleEditing}
                          value={scheduleEntries[0]?.sessionCost ?? ''}
                          onChange={(e) => {
                            const value =
                              e.target.value === ''
                                ? ''
                                : Number(e.target.value);
                            setScheduleEntries((prev) => {
                              const next = [...prev];
                              next[0] = {
                                ...(next[0] || {
                                  recurringId: null,
                                  nextDate: '',
                                  startTime: '',
                                  duration: 60 as 30 | 60,
                                  sessionCost: '',
                                }),
                                sessionCost: value,
                              };
                              return next;
                            });
                          }}
                          onWheel={(e) => e.currentTarget.blur()}
                          className="pl-7 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm disabled:bg-gray-100 disabled:text-gray-500"
                          min="0"
                          step="0.01"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Bloque B */}
                  <div className="border rounded-lg p-3">
                    <h5 className="text-xs font-semibold text-gray-600 mb-2">
                      Bloque B
                    </h5>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Próxima fecha
                        </label>
                        <input
                          type="date"
                          disabled={!isScheduleEditing}
                          value={scheduleEntries[1]?.nextDate || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            setScheduleEntries((prev) => {
                              const next = [...prev];
                              next[1] = {
                                ...(next[1] || {
                                  recurringId: null,
                                  nextDate: '',
                                  startTime: '',
                                  duration: 60 as 30 | 60,
                                  sessionCost: '',
                                }),
                                nextDate: value,
                              };
                              return next;
                            });
                          }}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm disabled:bg-gray-100 disabled:text-gray-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Hora inicio
                        </label>
                        <input
                          type="time"
                          disabled={!isScheduleEditing}
                          value={scheduleEntries[1]?.startTime || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            setScheduleEntries((prev) => {
                              const next = [...prev];
                              next[1] = {
                                ...(next[1] || {
                                  recurringId: null,
                                  nextDate: '',
                                  startTime: '',
                                  duration: 60 as 30 | 60,
                                  sessionCost: '',
                                }),
                                startTime: value,
                              };
                              return next;
                            });
                          }}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm disabled:bg-gray-100 disabled:text-gray-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Duración
                        </label>
                        <select
                          disabled={!isScheduleEditing}
                          value={scheduleEntries[1]?.duration ?? 60}
                          onChange={(e) => {
                            const value =
                              Number(e.target.value) === 30 ? 30 : 60;
                            setScheduleEntries((prev) => {
                              const next = [...prev];
                              next[1] = {
                                ...(next[1] || {
                                  recurringId: null,
                                  nextDate: '',
                                  startTime: '',
                                  duration: 60 as 30 | 60,
                                  sessionCost: '',
                                }),
                                duration: value,
                              };
                              return next;
                            });
                          }}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm disabled:bg-gray-100 disabled:text-gray-500"
                        >
                          <option value={30}>30 minutos</option>
                          <option value={60}>60 minutos</option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700">
                        Costo sesión
                      </label>
                      <div className="mt-1 relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 sm:text-sm">
                            $
                          </span>
                        </div>
                        <input
                          type="number"
                          disabled={!isScheduleEditing}
                          value={scheduleEntries[1]?.sessionCost ?? ''}
                          onChange={(e) => {
                            const value =
                              e.target.value === ''
                                ? ''
                                : Number(e.target.value);
                            setScheduleEntries((prev) => {
                              const next = [...prev];
                              next[1] = {
                                ...(next[1] || {
                                  recurringId: null,
                                  nextDate: '',
                                  startTime: '',
                                  duration: 60 as 30 | 60,
                                  sessionCost: '',
                                }),
                                sessionCost: value,
                              };
                              return next;
                            });
                          }}
                          onWheel={(e) => e.currentTarget.blur()}
                          className="pl-7 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm disabled:bg-gray-100 disabled:text-gray-500"
                          min="0"
                          step="0.01"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {isScheduleEditing && (
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsScheduleEditing(false);
                      setScheduleError(null);
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveSchedule}
                    disabled={scheduleLoading || scheduleBlockedForInactive}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {scheduleLoading ? 'Guardando...' : 'Guardar agenda'}
                  </button>
                </div>
              )}
            </div>
          )}

          {!scheduleLoading && !scheduleRecurringId && !scheduleGroupId && !scheduleError && (
            <p className="text-sm text-gray-500">
              Este paciente no tiene una agenda recurrente configurada. Usa el botón
              &quot;Crear agenda&quot; para configurarla cuando tenga frecuencia y
              profesional asignados.
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? 'Guardando...' : 'Guardar'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              Editar
            </button>
          )}
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
  onSubmit: (data: {
    name: string;
    description: string;
    status?: 'active' | 'pending' | 'inactive';
    professionalId?: string;
    sessionFrequency?: 'weekly' | 'biweekly' | 'monthly' | 'twice_weekly';
    nextAppointmentDate?: string;
    nextAppointmentStartTime?: string;
    nextAppointmentEndTime?: string;
    sessionCost?: number;
    textNote?: string;
    audioNote?: string;
    entriesA?: {
      nextAppointmentDate: string;
      nextAppointmentStartTime: string;
      nextAppointmentEndTime: string;
      sessionDuration: 30 | 60;
      sessionCost: number | '';
    };
    entriesB?: {
      nextAppointmentDate: string;
      nextAppointmentStartTime: string;
      nextAppointmentEndTime: string;
      sessionDuration: 30 | 60;
      sessionCost: number | '';
    };
  }) => Promise<void>;
  showDescription?: boolean;
  professionals: Professional[];
}

const NewPatientModal: React.FC<NewPatientModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  showDescription = false,
  professionals,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'active' | 'pending' | 'inactive'>('pending');
  const [professionalId, setProfessionalId] = useState('');
  const [sessionFrequency, setSessionFrequency] = useState<
    'weekly' | 'biweekly' | 'monthly' | 'twice_weekly' | ''
  >('');
  const [nextAppointmentDate, setNextAppointmentDate] = useState('');
  const [nextAppointmentStartTime, setNextAppointmentStartTime] = useState('');
  const [nextAppointmentEndTime, setNextAppointmentEndTime] = useState('');
  const [sessionDuration, setSessionDuration] = useState<30 | 60>(60);
  const [sessionCost, setSessionCost] = useState<number | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasTriedSubmit, setHasTriedSubmit] = useState(false);
  const [textNote, setTextNote] = useState('');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [entryA, setEntryA] = useState<{
    nextAppointmentDate: string;
    nextAppointmentStartTime: string;
    nextAppointmentEndTime: string;
    sessionDuration: 30 | 60;
    sessionCost: number | '';
  }>({
    nextAppointmentDate: '',
    nextAppointmentStartTime: '',
    nextAppointmentEndTime: '',
    sessionDuration: 60,
    sessionCost: '',
  });

  // Resetear formulario al cerrar el modal
  useEffect(() => {
    if (!isOpen) {
      setName('');
      setDescription('');
      setStatus('pending');
      setProfessionalId('');
      setSessionFrequency('');
      setNextAppointmentDate('');
      setNextAppointmentStartTime('');
      setNextAppointmentEndTime('');
      setSessionDuration(60);
      setSessionCost('');
      setHasTriedSubmit(false);
      setTextNote('');
      setAudioBlob(null);
      setEntryA({
        nextAppointmentDate: '',
        nextAppointmentStartTime: '',
        nextAppointmentEndTime: '',
        sessionDuration: 60,
        sessionCost: '',
      });
      setEntryB({
        nextAppointmentDate: '',
        nextAppointmentStartTime: '',
        nextAppointmentEndTime: '',
        sessionDuration: 60,
        sessionCost: '',
      });
    }
  }, [isOpen]);
  const [entryB, setEntryB] = useState<{
    nextAppointmentDate: string;
    nextAppointmentStartTime: string;
    nextAppointmentEndTime: string;
    sessionDuration: 30 | 60;
    sessionCost: number | '';
  }>({
    nextAppointmentDate: '',
    nextAppointmentStartTime: '',
    nextAppointmentEndTime: '',
    sessionDuration: 60,
    sessionCost: '',
  });

  const calculateEndTime = (startTime: string, durationMinutes: number = 60): string => {
    if (!startTime) return '';
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
  };

  const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const startTime = e.target.value;
    setNextAppointmentStartTime(startTime);
    if (startTime) {
      setNextAppointmentEndTime(calculateEndTime(startTime, sessionDuration));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasTriedSubmit(true);

    if (!name.trim()) {
      toast.error('Por favor, ingresa el nombre del paciente');
      return;
    }

    const isActiveWithFrequency =
      status === 'active' &&
      !!sessionFrequency &&
      sessionFrequency !== 'twice_weekly';

    // Validar que si hay frecuencia para un paciente ACTIVO, también haya próxima cita completa
    if (isActiveWithFrequency && !nextAppointmentDate) {
      toast.error('Si defines una frecuencia de sesiones, debes especificar la fecha de la próxima cita');
      return;
    }

    // Validar que si hay próxima cita, también haya profesional
    if (isActiveWithFrequency && nextAppointmentDate && !professionalId) {
      toast.error('Debes seleccionar un profesional para crear la próxima cita');
      return;
    }

    // Validar que si hay próxima cita, también haya hora de inicio
    if (isActiveWithFrequency && nextAppointmentDate && !nextAppointmentStartTime) {
      toast.error('Debes especificar la hora de inicio de la próxima cita');
      return;
    }

    setIsSubmitting(true);
    try {
      let audioNoteUrl: string | undefined;
      const trimmedTextNote = textNote.trim();

      if (audioBlob) {
        if (audioBlob.size === 0) {
          toast.error('El audio grabado está vacío. Por favor, graba nuevamente.');
          setIsSubmitting(false);
          return;
        }

        const audioFile = new File([audioBlob], 'note.webm', {
          type: 'audio/webm',
        });

        try {
          audioNoteUrl = await patientsService.uploadAudio(audioFile);
        } catch (error: any) {
          console.error('Error al subir el audio:', error);
          const errorMessage = error?.message || 'Error al subir el audio';
          toast.error(errorMessage);
          setIsSubmitting(false);
          return;
        }
      }

      await onSubmit({
        name,
        description,
        status,
        professionalId: professionalId || undefined,
        sessionFrequency: sessionFrequency || undefined,
        nextAppointmentDate:
          sessionFrequency === 'twice_weekly'
            ? undefined
            : nextAppointmentDate || undefined,
        nextAppointmentStartTime:
          sessionFrequency === 'twice_weekly'
            ? undefined
            : nextAppointmentStartTime || undefined,
        nextAppointmentEndTime:
          sessionFrequency === 'twice_weekly'
            ? undefined
            : nextAppointmentEndTime || undefined,
        sessionCost:
          sessionFrequency === 'twice_weekly'
            ? undefined
            : sessionCost !== ''
            ? Number(sessionCost)
            : undefined,
        textNote: trimmedTextNote || undefined,
        audioNote: audioNoteUrl,
        entriesA: sessionFrequency === 'twice_weekly' ? entryA : undefined,
        entriesB: sessionFrequency === 'twice_weekly' ? entryB : undefined,
      });
      // Reset form
      setName('');
      setDescription('');
      setStatus('pending');
      setProfessionalId('');
      setSessionFrequency('');
      setNextAppointmentDate('');
      setNextAppointmentStartTime('');
      setNextAppointmentEndTime('');
      setSessionDuration(60);
      setSessionCost('');
      setHasTriedSubmit(false);
      setTextNote('');
      setAudioBlob(null);
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
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Nombre del Paciente *
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
            <label htmlFor="status" className="block text-sm font-medium text-gray-700">
              Estado
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'active' | 'pending' | 'inactive')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="pending">Pendiente</option>
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
          </div>

          <div>
            <label htmlFor="professionalId" className="block text-sm font-medium text-gray-700">
              Profesional
            </label>
            <select
              id="professionalId"
              value={professionalId}
              onChange={(e) => setProfessionalId(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
            <label htmlFor="sessionFrequency" className="block text-sm font-medium text-gray-700">
              Frecuencia de Sesiones
            </label>
            <select
              id="sessionFrequency"
              value={sessionFrequency}
              onChange={(e) =>
                setSessionFrequency(
                  e.target.value as
                    | 'weekly'
                    | 'biweekly'
                    | 'monthly'
                    | 'twice_weekly'
                    | ''
                )
              }
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Sin frecuencia (solo primera cita)</option>
              <option value="weekly">Semanal</option>
              <option value="biweekly">Quincenal</option>
              <option value="monthly">Mensual</option>
              <option value="twice_weekly">2 veces por semana</option>
            </select>
            {sessionFrequency && sessionFrequency !== 'twice_weekly' && (
              <p className="mt-1 text-sm text-amber-600">
                ⚠️ Si defines una frecuencia, debes especificar la fecha de la próxima cita
              </p>
            )}
          </div>

          {sessionFrequency && sessionFrequency !== 'twice_weekly' && (
            <>
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Próxima Cita</h4>
                
                <div className="space-y-4">
                  <div>
                    <label htmlFor="nextAppointmentDate" className="block text-sm font-medium text-gray-700">
                      Fecha de la Próxima Cita *
                    </label>
                    <input
                      type="date"
                      id="nextAppointmentDate"
                      value={nextAppointmentDate}
                      onChange={(e) => setNextAppointmentDate(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      required={!!sessionFrequency}
                      min={new Date().toISOString().split('T')[0]}
                    />
                    {hasTriedSubmit && status === 'active' && sessionFrequency && !nextAppointmentDate && (
                      <p className="mt-1 text-xs text-red-600">
                        Debes ingresar la fecha de la próxima cita.
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="nextAppointmentStartTime" className="block text-sm font-medium text-gray-700">
                        Hora de inicio *
                      </label>
                      <input
                        type="time"
                        id="nextAppointmentStartTime"
                        value={nextAppointmentStartTime}
                        onChange={handleStartTimeChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        required={!!nextAppointmentDate && status === 'active' && !!sessionFrequency}
                        step={60}
                      />
                      {hasTriedSubmit && status === 'active' && sessionFrequency && !nextAppointmentStartTime && (
                        <p className="mt-1 text-xs text-red-600">
                          Debes ingresar la hora de inicio de la próxima cita.
                        </p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="sessionDuration" className="block text-sm font-medium text-gray-700">
                        Duración
                      </label>
                      <select
                        id="sessionDuration"
                        value={sessionDuration}
                        onChange={(e) => {
                          const value = Number(e.target.value) as 30 | 60;
                          setSessionDuration(value);
                          if (nextAppointmentStartTime) {
                            setNextAppointmentEndTime(calculateEndTime(nextAppointmentStartTime, value));
                          }
                        }}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      >
                        <option value={30}>30 minutos</option>
                        <option value={60}>60 minutos</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="nextAppointmentEndTime" className="block text-sm font-medium text-gray-700">
                        Hora de fin
                      </label>
                      <input
                        type="time"
                        id="nextAppointmentEndTime"
                        value={nextAppointmentEndTime}
                        onChange={(e) => setNextAppointmentEndTime(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        required={!!nextAppointmentDate && status === 'active' && !!sessionFrequency}
                        step={60}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="sessionCost" className="block text-sm font-medium text-gray-700">
                      Costo de la Sesión
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">$</span>
                      </div>
                      <input
                        type="number"
                        id="sessionCost"
                        value={sessionCost}
                        onChange={(e) => setSessionCost(e.target.value === '' ? '' : Number(e.target.value))}
                        onWheel={(e) => e.currentTarget.blur()}
                        className="pl-7 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {sessionFrequency === 'twice_weekly' && (
            <div className="border-t pt-4 space-y-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-1">
                Próximas Citas (2 veces por semana)
              </h4>

              {/* Bloque A */}
              <div className="border rounded-lg p-3">
                <h5 className="text-xs font-semibold text-gray-600 mb-2">
                  Bloque A
                </h5>

                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="entryADate"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Fecha de la Próxima Cita A *
                    </label>
                    <input
                      type="date"
                      id="entryADate"
                      value={entryA.nextAppointmentDate}
                      onChange={(e) =>
                        setEntryA((prev) => ({
                          ...prev,
                          nextAppointmentDate: e.target.value,
                        }))
                      }
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label
                        htmlFor="entryAStartTime"
                        className="block text-sm font-medium text-gray-700"
                      >
                        Hora de inicio A *
                      </label>
                      <input
                        type="time"
                        id="entryAStartTime"
                        value={entryA.nextAppointmentStartTime}
                        onChange={(e) => {
                          const startTime = e.target.value;
                          setEntryA((prev) => ({
                            ...prev,
                            nextAppointmentStartTime: startTime,
                            nextAppointmentEndTime: calculateEndTime(
                              startTime,
                              prev.sessionDuration
                            ),
                          }));
                        }}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        step={60}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="entryADuration"
                        className="block text-sm font-medium text-gray-700"
                      >
                        Duración A
                      </label>
                      <select
                        id="entryADuration"
                        value={entryA.sessionDuration}
                        onChange={(e) => {
                          const value =
                            Number(e.target.value) as 30 | 60;
                          setEntryA((prev) => ({
                            ...prev,
                            sessionDuration: value,
                            nextAppointmentEndTime:
                              prev.nextAppointmentStartTime
                                ? calculateEndTime(
                                    prev.nextAppointmentStartTime,
                                    value
                                  )
                                : prev.nextAppointmentEndTime,
                          }));
                        }}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      >
                        <option value={30}>30 minutos</option>
                        <option value={60}>60 minutos</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="entryAEndTime"
                        className="block text-sm font-medium text-gray-700"
                      >
                        Hora de fin A
                      </label>
                      <input
                        type="time"
                        id="entryAEndTime"
                        value={entryA.nextAppointmentEndTime}
                        onChange={(e) =>
                          setEntryA((prev) => ({
                            ...prev,
                            nextAppointmentEndTime: e.target.value,
                          }))
                        }
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        step={60}
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="entryACost"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Costo de la Sesión A
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">
                          $
                        </span>
                      </div>
                      <input
                        type="number"
                        id="entryACost"
                        value={entryA.sessionCost}
                        onChange={(e) =>
                          setEntryA((prev) => ({
                            ...prev,
                            sessionCost:
                              e.target.value === ''
                                ? ''
                                : Number(e.target.value),
                          }))
                        }
                        onWheel={(e) => e.currentTarget.blur()}
                        className="pl-7 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bloque B */}
              <div className="border rounded-lg p-3">
                <h5 className="text-xs font-semibold text-gray-600 mb-2">
                  Bloque B
                </h5>

                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="entryBDate"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Fecha de la Próxima Cita B *
                    </label>
                    <input
                      type="date"
                      id="entryBDate"
                      value={entryB.nextAppointmentDate}
                      onChange={(e) =>
                        setEntryB((prev) => ({
                          ...prev,
                          nextAppointmentDate: e.target.value,
                        }))
                      }
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label
                        htmlFor="entryBStartTime"
                        className="block text-sm font-medium text-gray-700"
                      >
                        Hora de inicio B *
                      </label>
                      <input
                        type="time"
                        id="entryBStartTime"
                        value={entryB.nextAppointmentStartTime}
                        onChange={(e) => {
                          const startTime = e.target.value;
                          setEntryB((prev) => ({
                            ...prev,
                            nextAppointmentStartTime: startTime,
                            nextAppointmentEndTime: calculateEndTime(
                              startTime,
                              prev.sessionDuration
                            ),
                          }));
                        }}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        step={60}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="entryBDuration"
                        className="block text-sm font-medium text-gray-700"
                      >
                        Duración B
                      </label>
                      <select
                        id="entryBDuration"
                        value={entryB.sessionDuration}
                        onChange={(e) => {
                          const value =
                            Number(e.target.value) as 30 | 60;
                          setEntryB((prev) => ({
                            ...prev,
                            sessionDuration: value,
                            nextAppointmentEndTime:
                              prev.nextAppointmentStartTime
                                ? calculateEndTime(
                                    prev.nextAppointmentStartTime,
                                    value
                                  )
                                : prev.nextAppointmentEndTime,
                          }));
                        }}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      >
                        <option value={30}>30 minutos</option>
                        <option value={60}>60 minutos</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="entryBEndTime"
                        className="block text-sm font-medium text-gray-700"
                      >
                        Hora de fin B
                      </label>
                      <input
                        type="time"
                        id="entryBEndTime"
                        value={entryB.nextAppointmentEndTime}
                        onChange={(e) =>
                          setEntryB((prev) => ({
                            ...prev,
                            nextAppointmentEndTime: e.target.value,
                          }))
                        }
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        step={60}
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="entryBCost"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Costo de la Sesión B
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">
                          $
                        </span>
                      </div>
                      <input
                        type="number"
                        id="entryBCost"
                        value={entryB.sessionCost}
                        onChange={(e) =>
                          setEntryB((prev) => ({
                            ...prev,
                            sessionCost:
                              e.target.value === ''
                                ? ''
                                : Number(e.target.value),
                          }))
                        }
                        onWheel={(e) => e.currentTarget.blur()}
                        className="pl-7 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showDescription && (
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
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Nota de Texto
            </label>
            <textarea
              value={textNote}
              onChange={(e) => setTextNote(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 resize-none"
              rows={4}
              placeholder="Escribe una nota sobre el paciente..."
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Nota de Audio
            </label>
            <AudioRecorder
              showLabel={false}
              onRecordingComplete={(blob) => {
                setAudioBlob(blob);
              }}
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
              disabled={
                isSubmitting ||
                !name.trim() ||
                (status === 'active' &&
                  !!sessionFrequency &&
                  sessionFrequency !== 'twice_weekly' &&
                  (!professionalId ||
                    !nextAppointmentDate ||
                    !nextAppointmentStartTime)) ||
                (status === 'active' &&
                  sessionFrequency === 'twice_weekly' &&
                  (!professionalId ||
                    !entryA.nextAppointmentDate ||
                    !entryA.nextAppointmentStartTime ||
                    !entryB.nextAppointmentDate ||
                    !entryB.nextAppointmentStartTime))
              }
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
      case 'twice_weekly': return '2 veces por semana';
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
    case 'twice_weekly': return '2 veces por semana';
    default: return 'No asignada';
  }
};

type PatientManagementStatus = 'all' | 'active' | 'pending' | 'inactive';

const PatientManagement = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
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
  const [frequencyFilter, setFrequencyFilter] = useState<
    'all' | 'weekly' | 'biweekly' | 'monthly' | 'twice_weekly'
  >('all');
  const [isFrequencyModalOpen, setIsFrequencyModalOpen] = useState(false);
  const [selectedFrequencyRequest, setSelectedFrequencyRequest] = useState<FrequencyRequest | null>(null);
  const [isActivationRequestModalOpen, setIsActivationRequestModalOpen] = useState(false);
  const [selectedActivationRequest, setSelectedActivationRequest] = useState<StatusRequest | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  // Preservar el origen de navegación en estado local para que no se pierda
  const [navigationFrom, setNavigationFrom] = useState<string | undefined>(
    (location.state as { from?: string } | null)?.from
  );

  useEffect(() => {
    loadData();
    // Preservar el origen de navegación cuando cambia location.state
    const from = (location.state as { from?: string } | null)?.from;
    if (from) {
      setNavigationFrom(from);
    }
  }, [location.state]);

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

    const state = location.state as { openFrequencyRequest?: { patientId: string; requestId?: string }; from?: string } | null;
    if (!state?.openFrequencyRequest) return;

    const { patientId, requestId } = state.openFrequencyRequest;
    const patient = patients.find((p) => String(p.id) === String(patientId));

    const finalize = () => {
      const from = state?.from || navigationFrom;
      if (from) {
        setNavigationFrom(from);
      }
      navigate('.', { replace: true, state: { from: from } });
    };

    if (!patient) {
      toast.error('Paciente no encontrado para la solicitud.');
      finalize();
      return;
    }

    void openFrequencyRequestModal(patient, requestId).finally(finalize);
  }, [patients, location.state, isLoading, navigate, openFrequencyRequestModal, navigationFrom]);

  useEffect(() => {
    if (isLoading) return;

    const state = location.state as { openStatusRequest?: { patientId: string; requestId?: string }; from?: string } | null;
    if (!state?.openStatusRequest) return;

    const { patientId, requestId } = state.openStatusRequest;
    const patient = patients.find((p) => String(p.id) === String(patientId));

    const finalize = () => {
      const from = state?.from || navigationFrom;
      if (from) {
        setNavigationFrom(from);
      }
      navigate('.', { replace: true, state: { from: from } });
    };

    if (!patient) {
      toast.error('Paciente no encontrado para la solicitud.');
      finalize();
      return;
    }

    void openStatusRequestModal(patient, requestId).finally(finalize);
  }, [patients, location.state, isLoading, navigate, openStatusRequestModal, navigationFrom]);

  useEffect(() => {
    if (isLoading) return;

    const state = location.state as { openActivationRequest?: { patientId: string; requestId?: string }; from?: string } | null;
    if (!state?.openActivationRequest) return;

    const { patientId, requestId } = state.openActivationRequest;
    const patient = patients.find((p) => String(p.id) === String(patientId));

    const finalize = () => {
      const from = state?.from || navigationFrom;
      if (from) {
        setNavigationFrom(from);
      }
      navigate('.', { replace: true, state: { from: from } });
    };

    if (!patient) {
      toast.error('Paciente no encontrado para la solicitud.');
      finalize();
      return;
    }

    void openActivationRequestModal(patient, requestId).finally(finalize);
  }, [patients, location.state, isLoading, navigate, openActivationRequestModal, navigationFrom]);

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

  const handleAddPatient = async (data: {
    name: string;
    description: string;
    status?: 'active' | 'pending' | 'inactive';
    professionalId?: string;
    sessionFrequency?: 'weekly' | 'biweekly' | 'monthly' | 'twice_weekly';
    nextAppointmentDate?: string;
    nextAppointmentStartTime?: string;
    nextAppointmentEndTime?: string;
    sessionCost?: number;
    textNote?: string;
    audioNote?: string;
    entriesA?: {
      nextAppointmentDate: string;
      nextAppointmentStartTime: string;
      nextAppointmentEndTime: string;
      sessionDuration: 30 | 60;
      sessionCost: number | '';
    };
    entriesB?: {
      nextAppointmentDate: string;
      nextAppointmentStartTime: string;
      nextAppointmentEndTime: string;
      sessionDuration: 30 | 60;
      sessionCost: number | '';
    };
  }) => {
    try {
      // Paso 1: Crear paciente
      const newPatient: CreatePatientDTO = {
        name: data.name,
        description: data.description,
      };
      
      const createdPatient = await patientsService.addPatient(newPatient);
      const patientId = createdPatient.id;

      // Si hay professionalId, asignar el paciente
      if (data.professionalId) {
        try {
          await patientsService.assignPatient({
            patientId,
            professionalId: data.professionalId,
            status: data.status,
            sessionFrequency: data.sessionFrequency as any,
            textNote: data.textNote,
            audioNote: data.audioNote,
            professionalName: '',
          });
        } catch (assignError) {
          console.error('Error al asignar paciente:', assignError);
          // Continuar aunque falle la asignación, el paciente ya está creado
        }
      }

      // Paso 2 (especial): crear agenda twice_weekly directamente
      if (
        data.status === 'active' &&
        data.sessionFrequency === 'twice_weekly' &&
        data.professionalId &&
        data.entriesA?.nextAppointmentDate &&
        data.entriesB?.nextAppointmentDate
      ) {
        try {
          await recurringAppointmentsService.createPatientRecurringScheduleAdmin(
            patientId,
            {
              frequency: 'twice_weekly',
              entries: [
                {
                  nextDate: data.entriesA.nextAppointmentDate,
                  startTime: data.entriesA.nextAppointmentStartTime,
                  duration: data.entriesA.sessionDuration,
                  sessionCost: Number(data.entriesA.sessionCost),
                },
                {
                  nextDate: data.entriesB.nextAppointmentDate,
                  startTime: data.entriesB.nextAppointmentStartTime,
                  duration: data.entriesB.sessionDuration,
                  sessionCost: Number(data.entriesB.sessionCost),
                },
              ],
            }
          );
          toast.success(
            'Paciente y agenda (2 veces por semana) creados correctamente.'
          );
        } catch (err) {
          console.error('Error al crear agenda twice_weekly:', err);
          toast.error(
            'Paciente creado, pero hubo un error al configurar la agenda. Podés configurarla manualmente después.'
          );
        }
        await loadData();
        return; // No continuar con el flujo de cita simple
      }

      // Paso 2: Crear la primera cita si hay fecha y profesional (frecuencias simples)
      let appointmentId: string | null = null;
      if (
        data.status === 'active' &&
        data.nextAppointmentDate &&
        data.professionalId &&
        data.nextAppointmentStartTime
      ) {
        try {
          const appointment = await appointmentsService.createAppointment({
            patientId,
            professionalId: data.professionalId,
            date: data.nextAppointmentDate,
            startTime: data.nextAppointmentStartTime,
            endTime: data.nextAppointmentEndTime || calculateEndTime(data.nextAppointmentStartTime, 60),
            type: 'regular',
            status: 'scheduled',
            sessionCost: data.sessionCost,
          });
          appointmentId = appointment.id;
          toast.success('Paciente y primera cita creados exitosamente');
        } catch (appointmentError) {
          console.error('Error al crear la primera cita:', appointmentError);
          toast.error('Paciente creado, pero hubo un error al crear la primera cita. Puedes crearla manualmente después.');
          // No lanzar error, el paciente ya está creado
        }
      }

      // Paso 3: Registrar recurrencia si hay sessionFrequency y appointmentId (frecuencias simples)
      if (
        data.status === 'active' &&
        data.sessionFrequency &&
        appointmentId &&
        (data.sessionFrequency === 'weekly' ||
          data.sessionFrequency === 'biweekly' ||
          data.sessionFrequency === 'monthly')
      ) {
        try {
          await recurringAppointmentsService.createRecurringAppointment({
            baseAppointmentId: Number(appointmentId),
            frequency: data.sessionFrequency,
          });
          toast.success('Recurrencia configurada correctamente. El CRON generará las citas futuras automáticamente.');
        } catch (recurrenceError) {
          console.error('Error al crear recurrencia:', recurrenceError);
          toast.error('Paciente y cita creados, pero hubo un error al configurar la recurrencia. Puedes configurarla manualmente después.');
          // No lanzar error, el paciente y la cita ya están creados
        }
      } else if (data.sessionFrequency && !appointmentId) {
        toast.error('No se pudo crear la recurrencia porque no se pudo crear la primera cita. Por favor, crea la cita manualmente y luego configura la recurrencia.');
      }

      await loadData();
    } catch (error) {
      console.error('Error al agregar paciente:', error);
      toast.error('Error al agregar el paciente');
      throw error;
    }
  };

  // Helper function para calcular hora de fin
  const calculateEndTime = (startTime: string, durationMinutes: number = 60): string => {
    if (!startTime) return '';
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
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
              onClick={() => {
                if (navigationFrom === 'activities') {
                  navigate('/admin/actividad');
                } else {
                  navigate('/admin');
                }
              }}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              {navigationFrom === 'activities' ? 'Volver' : 'Volver al Dashboard'}
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
              onChange={(e) =>
                setFrequencyFilter(
                  e.target.value as
                    | 'all'
                    | 'weekly'
                    | 'biweekly'
                    | 'monthly'
                    | 'twice_weekly'
                )
              }
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-lg"
            >
              <option value="all">Todas las frecuencias</option>
              <option value="weekly">Semanal</option>
              <option value="biweekly">Quincenal</option>
              <option value="monthly">Mensual</option>
              <option value="twice_weekly">2 veces por semana</option>
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
                      title="Ver paciente"
                    >
                      <EyeIcon className="h-5 w-5" />
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
                              title="Ver paciente"
                            >
                              <EyeIcon className="h-5 w-5" />
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
        professionals={professionals}
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

      {isViewDescriptionModalOpen && selectedPatient && (
        <ViewDescriptionModal
          isOpen={isViewDescriptionModalOpen}
          onClose={() => {
            setIsViewDescriptionModalOpen(false);
            setSelectedPatient(null);
          }}
          patient={selectedPatient}
          professionals={professionals}
          onUpdatePatient={async (id, data) => {
            try {
              const updated = await patientsService.updatePatient(id, data);
              setPatients((prev) =>
                prev.map((p) => (p.id === updated.id ? updated : p))
              );
              toast.success('Paciente actualizado correctamente');
            } catch (error) {
              console.error('Error al actualizar paciente:', error);
              toast.error('Error al actualizar el paciente');
              throw error;
            }
          }}
          onScheduleUpdated={async () => {
            await loadData();
          }}
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