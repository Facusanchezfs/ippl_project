import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import patientsService from '../../services/patients.service';
import appointmentsService from '../../services/appointments.service';
import { Appointment } from '../../types/Appointment';
import { parseNumber } from '../../utils/functionUtils.ts';
import { getFriendlyErrorMessage, ErrorMessages } from '../../utils/errorMessages';
import { 
  UserIcon, 
  ClockIcon,
  CalendarIcon,
  ArrowPathIcon,
  ArrowRightOnRectangleIcon,
  CurrencyDollarIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import Modal from '../Modal';
import RecentActivityProfessional from '../professional/RecentActivityProfessional';
import {Patient} from "../../types/Patient.ts";
import userService, {User, UpdateUserData} from '../../services/user.service.ts';
import ChangePasswordModal from '../professional/ChangePassword.tsx';

const PsychologistDashboard = () => {
  const { user, logout } = useAuth();
  const [userLoaded, setUserLoaded] = useState<User>();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showPatientsModal, setShowPatientsModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [patientsData, appointmentsData, userPromise] = await Promise.all([
        patientsService.getProfessionalPatients(user!.id),
        appointmentsService.getProfessionalAppointments(user!.id),
        userService.getUserById(parseNumber(user?.id))
      ]);
      setPatients(patientsData);
      setAppointments(appointmentsData);
      setUserLoaded(userPromise);
    } catch (error) {
      console.error('Error al cargar datos:', error);
      const friendlyMessage = getFriendlyErrorMessage(error, 'No se pudieron cargar los datos. Intenta recargar la página.');
      toast.error(friendlyMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
    toast.success('Datos actualizados');
  };

  const changePassword = async (newPassword: string) =>{
    try{
      if (!userLoaded) {
        toast.error('Los datos del usuario no están disponibles. Intenta recargar la página.');
        return;
      }
      
      const updateData: UpdateUserData = {};
      updateData.password = newPassword;
      await userService.updateUser(userLoaded.id, updateData);
      toast.success('Contraseña cambiada correctamente');
    } catch (e) {
      console.error('Error al cambiar contraseña:', e);
      const friendlyMessage = getFriendlyErrorMessage(e, ErrorMessages.PASSWORD_CHANGE_FAILED);
      toast.error(friendlyMessage);
    }
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toLocalDateFromYMD = (ymd: string) => {
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const isSameLocalDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

  const activePatients = patients.filter(p => p.status === 'active');
  const completedAppointments = appointments.filter(a => a.status === 'completed');
  const todayAppointments = appointments.filter(a => {
  const appointmentDate = toLocalDateFromYMD(a.date);
    const today = new Date();
    return isSameLocalDay(appointmentDate, today) && a.status !== 'completed';
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      {/* Header con Stats */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Bienvenido, {user?.name}
            </h1>
            <p className="text-gray-600 mt-1">Panel de control</p>
          </div>

          <div className="flex items-center gap-4 flex-wrap md:justify-end">
            {user?.role === 'professional' && (
              <button
                onClick={() => setShowModal(true)}
                disabled={!userLoaded}
                className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  userLoaded 
                    ? 'text-blue-700 bg-blue-50 hover:bg-blue-100' 
                    : 'text-gray-400 bg-gray-100 cursor-not-allowed'
                }`}
              >
                <AdjustmentsHorizontalIcon className="h-5 w-5 mr-2" />
                Cambiar contraseña
              </button>
            )}

            <button
              onClick={handleRefresh}
              className={`flex items-center px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors ${isRefreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={isRefreshing}
            >
              <ArrowPathIcon className={`h-5 w-5 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Actualizar datos
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center px-4 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5 mr-2" />
              Cerrar Sesión
            </button>
          </div>
        </div>


        {/* Recuadros de saldo */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 col-span-1 md:col-span-2 flex items-center hover:shadow-lg transition-all duration-200">
            <div className="bg-green-500/10 p-3 rounded-lg">
              <CurrencyDollarIcon className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-3xl font-bold text-gray-900">${userLoaded?.saldoTotal}</h3>
              <p className="text-lg text-gray-600 font-semibold">Saldo Total</p>
            </div>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 col-span-1 md:col-span-2 flex items-center hover:shadow-lg transition-all duration-200">
            <div className="bg-red-500/10 p-3 rounded-lg">
              <CurrencyDollarIcon className="h-8 w-8 text-red-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-3xl font-bold text-gray-900">${userLoaded?.saldoPendiente}</h3>
              <p className="text-lg text-gray-600 font-semibold">Saldo Pendiente</p>
            </div>
          </div>
        </div>

        {/* Recuadros de stats normales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div 
            onClick={() => navigate('/professional/pacientes')}
            className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 cursor-pointer hover:shadow-lg transition-all duration-200"
          >
            <div className="flex items-center">
              <div className="bg-blue-500/10 p-3 rounded-lg">
                <UserIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-2xl font-bold text-gray-900">{activePatients.length}</h3>
                <p className="text-sm text-gray-600">Pacientes Activos</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-6 cursor-pointer hover:shadow-lg transition-all duration-200" onClick={() => navigate('/professional/citas-finalizadas')}>
            <div className="flex items-center">
              <div className="bg-yellow-500/10 p-3 rounded-lg">
                <ClockIcon className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-2xl font-bold text-gray-900">{completedAppointments.length}</h3>
                <p className="text-sm text-gray-600">Citas Finalizadas</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 cursor-pointer hover:shadow-lg transition-all duration-200" onClick={() => navigate('/professional/citas-hoy')}>
            <div className="flex items-center">
              <div className="bg-green-500/10 p-3 rounded-lg">
                <CalendarIcon className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-2xl font-bold text-gray-900">{todayAppointments.length} Hoy</h3>
                <p className="text-sm text-gray-600">Citas pendientes</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 cursor-pointer hover:shadow-lg transition-all duration-200" onClick={() => navigate('/professional/calendario')}>
            <div className="flex items-center">
              <div className="bg-purple-500/10 p-3 rounded-lg">
                <CalendarIcon className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-2xl font-bold text-gray-900">Calendario</h3>
                <p className="text-sm text-gray-600">Ver todas las citas</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actividad Reciente */}
      <RecentActivityProfessional />

      {/* Modal de Pacientes Activos */}
      <Modal isOpen={showPatientsModal} onClose={() => setShowPatientsModal(false)}>
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Pacientes Activos</h2>
            <button
              onClick={() => setShowPatientsModal(false)}
              className="text-gray-400 hover:text-gray-500"
            >
              <ArrowPathIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nombre
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha Asignación
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Notas
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {activePatients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{patient.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {patient.assignedAt ? new Date(patient.assignedAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {patient.audioNote ? (
                        <div className="flex items-center">
                          <audio
                            controls
                            className="w-48 h-10"
                            controlsList="nodownload"
                          >
                            <source src={patient.audioNote} type="audio/webm" />
                            <source src={patient.audioNote} type="audio/ogg" />
                            <source src={patient.audioNote} type="audio/mpeg" />
                            Tu navegador no soporta el elemento de audio.
                          </audio>
                        </div>
                      ) : patient.textNote ? (
                        <div className="max-w-xs">
                          <p className="text-sm text-gray-600 line-clamp-2 break-words">
                            {patient.textNote}
                          </p>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">Sin notas</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {activePatients.length === 0 && (
            <div className="text-center py-8">
              <UserIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No hay pacientes activos</h3>
              <p className="mt-1 text-sm text-gray-500">
                Aún no tienes pacientes activos asignados
              </p>
            </div>
          )}
        </div>
      </Modal>

      <ChangePasswordModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={changePassword}
      />;
    </div>
  );
};

export default PsychologistDashboard; 