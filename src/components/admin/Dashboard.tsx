import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import statsService, { SystemStats, ProfessionalStats } from '../../services/stats.service';
import { messageService, Message } from '../../services/messageService';
import postsService, { Post } from '../../services/posts.service';
import activityService from '../../services/activity.service';
import { Activity } from '../../types/Activity';
import userService, { UpdateUserData, User } from '../../services/user.service';
import { parseNumber } from '../../utils/functionUtils';
import ChangePasswordModal from '../professional/ChangePassword';
import { getFriendlyErrorMessage, ErrorMessages } from '../../utils/errorMessages';
import { 
  UserGroupIcon, 
  DocumentTextIcon, 
  UserIcon,
  ChartBarIcon,
  CalendarIcon,
  ClipboardDocumentListIcon,
  ChatBubbleLeftRightIcon,
  ArrowPathIcon,
  BriefcaseIcon,
  NewspaperIcon,
  PresentationChartLineIcon,
  BookOpenIcon,
  AdjustmentsHorizontalIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import axios from 'axios';
import frequencyRequestService from '../../services/frequencyRequest.service';
import statusRequestService from '../../services/statusRequest.service';
import patientsService from '../../services/patients.service';

// Interfaces
interface ActivityItemProps {
  color: string;
  text: string;
  time: string;
  onClick?: () => Promise<void> | void;
}

const MAX_MESSAGES = 2; // Número máximo de mensajes a mostrar
const MAX_ACTIVITIES = 3; // Número máximo de actividades a mostrar

const DASHBOARD_ACTIVITY_TYPES: Activity['type'][] = [
  'PATIENT_DISCHARGE_REQUEST',
  'PATIENT_ACTIVATION_REQUEST',
  'FREQUENCY_CHANGE_REQUEST',
  'FREQUENCY_CHANGE_REQUESTED'
];

const translateFrequency = (freq?: string | null) => {
  switch (freq) {
    case 'weekly':
      return 'Semanal';
    case 'biweekly':
      return 'Quincenal';
    case 'monthly':
      return 'Mensual';
    default:
      return freq || '';
  }
};

const translateActivity = (activity: Activity): Activity => {
  if (activity.type.startsWith('FREQUENCY_CHANGE')) {
    const professionalName = activity.metadata?.professionalName || 'Un profesional';
    const patientName = activity.metadata?.patientName || 'un paciente';
    const currentFrequency = translateFrequency(activity.metadata?.currentFrequency as string);
    const requestedFrequency = translateFrequency((activity.metadata?.requestedFrequency as string) || (activity.metadata?.newFrequency as string));

    if (activity.type === 'FREQUENCY_CHANGE_REQUEST' || activity.type === 'FREQUENCY_CHANGE_REQUESTED') {
      // Si falta información de frecuencia, mostrar un mensaje más claro
      if (!currentFrequency && !requestedFrequency) {
        return {
          ...activity,
          title: 'Solicitud de cambio de frecuencia',
          description: `${professionalName} solicitó cambiar la frecuencia de sesiones de ${patientName}`,
        };
      }
      if (!currentFrequency) {
        return {
          ...activity,
          title: 'Solicitud de cambio de frecuencia',
          description: `${professionalName} solicitó cambiar la frecuencia de sesiones de ${patientName} a ${requestedFrequency}`,
        };
      }
      if (!requestedFrequency) {
        return {
          ...activity,
          title: 'Solicitud de cambio de frecuencia',
          description: `${professionalName} solicitó cambiar la frecuencia de sesiones de ${patientName} desde ${currentFrequency}`,
        };
      }
      return {
        ...activity,
        title: 'Solicitud de cambio de frecuencia',
        description: `${professionalName} solicitó cambiar la frecuencia de sesiones de ${patientName} de ${currentFrequency} a ${requestedFrequency}`,
      };
    }

    const actionText = activity.type === 'FREQUENCY_CHANGE_APPROVED' ? 'aprobó' : 'rechazó';
    return {
      ...activity,
      title: `Solicitud de cambio de frecuencia ${actionText}`,
      description: `Se ${actionText} el cambio de frecuencia para ${patientName}${requestedFrequency ? ` a ${requestedFrequency}` : ''}`,
    };
  }

  return activity;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [professionalStats, setProfessionalStats] = useState<ProfessionalStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [recentMessages, setRecentMessages] = useState<Message[]>([]);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [recentPosts, setRecentPosts] = useState<Post[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [userLoaded, setUserLoaded] = useState<User>();
  const [resolvedActivities, setResolvedActivities] = useState<Set<string>>(new Set());
  const [financialMetrics, setFinancialMetrics] = useState({
    ingresosDelMes: 0,
    cantidadSolicitudes: 0,
    pagosPendientes: 0,
  });

  useEffect(() => {
    loadStats();
    loadRecentMessages();
    loadRecentPosts();
    loadActivities();
    loadFinancialMetrics();
    if (user) {
      loadUser();
    }
  }, [user]);

  const loadUser = async () => {
    try {
      const userToLoad = await userService.getUserById(parseNumber(user?.id));
      setUserLoaded(userToLoad);
    } catch (error) {
      console.error('Error al cargar usuario:', error);
    }
  };

  const loadStats = async () => {
    try {
      setIsLoading(true);
      setStatsError(null);
      if (user?.role === 'admin') {
        const stats = await statsService.getSystemStats();
        setSystemStats(stats);
      } else if (user?.role === 'professional') {
        const stats = await statsService.getProfessionalStats(user.id);
        setProfessionalStats(stats);
      }
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
      setStatsError('Error al cargar las estadísticas del sistema');
      // Establecer valores por defecto para evitar que la UI se rompa
      if (user?.role === 'admin') {
        setSystemStats({
          users: { total: 0, active: 0, byRole: { admin: 0, professional: 0, content_manager: 0 } },
          patients: { total: 0, active: 0, withAppointments: 0, byProfessional: {} },
          posts: { total: 0, published: 0, drafts: 0, comments: 0, totalViews: 0, totalLikes: 0, bySection: {} },
          appointments: { upcoming: 0, completed: 0 }
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadRecentMessages = async () => {
    try {
      setMessageError(null);
      const response = await messageService.getMessages();
      // Ordenar mensajes por fecha y tomar solo los más recientes
      const sortedMessages = response
        .sort((a: any, b: any) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
        .slice(0, MAX_MESSAGES);
      setRecentMessages(sortedMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
      if (axios.isAxiosError(error) && error.code === 'ERR_NETWORK') {
        setMessageError('No se pudo conectar con el servidor de mensajes');
      } else {
        setMessageError('Error al cargar los mensajes');
      }
    }
  };

  const loadRecentPosts = async () => {
    try {
      const response = await postsService.getAllPosts();
      // Ordenar los posts por fecha de publicación y tomar los 4 más recientes
      const sortedPosts = response.posts
        .filter(post => post.status === 'published')
        .sort((a, b) => new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime())
        .slice(0, 4);
      setRecentPosts(sortedPosts);
    } catch (error) {
      console.error('Error al cargar posts recientes:', error);
    }
  };

  const loadActivities = async () => {
    try {
      setActivityError(null);
      const data = await activityService.getActivities();
      const filteredActivities = data
        .filter(activity => DASHBOARD_ACTIVITY_TYPES.includes(activity.type))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, MAX_ACTIVITIES)
        .map(translateActivity);
      setActivities(filteredActivities);

      // Verificar qué actividades de frecuencia y status ya están resueltas
      try {
        const [pendingFrequencyRequests, pendingStatusRequests] = await Promise.all([
          frequencyRequestService.getPendingRequests(),
          statusRequestService.getPendingRequests()
        ]);
        
        const pendingFrequencyPatientIds = new Set(
          pendingFrequencyRequests.map(r => String(r.patientId))
        );
        
        const pendingDischargePatientIds = new Set(
          pendingStatusRequests
            .filter(r => r.requestedStatus === 'inactive' && r.type !== 'activation')
            .map(r => String(r.patientId))
        );
        
        const pendingActivationPatientIds = new Set(
          pendingStatusRequests
            .filter(r => r.type === 'activation' && r.requestedStatus === 'active')
            .map(r => String(r.patientId))
        );
        
        const resolved = new Set<string>();
        filteredActivities.forEach(activity => {
          if (activity.metadata?.patientId) {
            const patientId = String(activity.metadata.patientId);
            
            // Verificar actividades de frecuencia
            if (
              activity.type === 'FREQUENCY_CHANGE_REQUEST' || 
              activity.type === 'FREQUENCY_CHANGE_REQUESTED'
            ) {
              if (!pendingFrequencyPatientIds.has(patientId)) {
                resolved.add(activity._id);
              }
            }
            
            // Verificar actividades de baja
            if (activity.type === 'PATIENT_DISCHARGE_REQUEST') {
              if (!pendingDischargePatientIds.has(patientId)) {
                resolved.add(activity._id);
              }
            }
            
            // Verificar actividades de activación
            if (activity.type === 'PATIENT_ACTIVATION_REQUEST') {
              if (!pendingActivationPatientIds.has(patientId)) {
                resolved.add(activity._id);
              }
            }
          }
        });
        setResolvedActivities(resolved);
      } catch (error) {
        console.error('Error al verificar solicitudes pendientes:', error);
        // Si falla, no marcamos nada como resuelto para mantener el comportamiento actual
      }
    } catch (error) {
      console.error('Error loading activities:', error);
      setActivityError('Error al cargar las actividades');
    }
  };

  const loadFinancialMetrics = async () => {
    try {
      // Cargar todas las métricas en paralelo
      const [allAbonos, allPatients, allProfessionals] = await Promise.all([
        userService.getAbonos(),
        patientsService.getAllPatients(),
        userService.getProfessionals(),
      ]);

      // 1. Ingresos del Mes: Filtrar abonos del mes actual y sumar amount
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      firstDayOfMonth.setHours(0, 0, 0, 0);
      const today = new Date(now);
      today.setHours(23, 59, 59, 999);

      const ingresosDelMes = allAbonos
        .filter((abono) => {
          const abonoDate = new Date(abono.date);
          return abonoDate >= firstDayOfMonth && abonoDate <= today;
        })
        .reduce((sum, abono) => sum + (Number(abono.amount) || 0), 0);

      // 2. Solicitudes: Cantidad total de pacientes
      const cantidadSolicitudes = Array.isArray(allPatients) ? allPatients.length : 0;

      // 3. Pagos Pendientes: Suma de saldoPendiente de todos los profesionales
      const pagosPendientes = allProfessionals.reduce(
        (sum, prof) => sum + (Number(prof.saldoPendiente) || 0),
        0
      );

      setFinancialMetrics({
        ingresosDelMes,
        cantidadSolicitudes,
        pagosPendientes,
      });
    } catch (error) {
      console.error('Error al cargar métricas financieras:', error);
      // En caso de error, mantener valores en 0 (fallback)
      setFinancialMetrics({
        ingresosDelMes: 0,
        cantidadSolicitudes: 0,
        pagosPendientes: 0,
      });
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadStats();
    await loadFinancialMetrics();
    setIsRefreshing(false);
    toast.success('Datos actualizados');
  };

  const changePassword = async (newPassword: string) => {
    try {
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
  };

  const handleActivityClick = async (activity: Activity) => {
    if (activity.type === 'FREQUENCY_CHANGE_REQUEST' || activity.type === 'FREQUENCY_CHANGE_REQUESTED') {
      const patientId = activity.metadata?.patientId ? String(activity.metadata.patientId) : null;
      if (!patientId) {
        toast.error('No se encontró información del paciente para esta solicitud. Por favor, contacte al administrador.');
        return;
      }

      try {
        const requests = await frequencyRequestService.getPendingRequests();
        const pendingRequest = requests.find((r) => String(r.patientId) === String(patientId));

        if (!pendingRequest) {
          toast.error('La solicitud ya fue resuelta');
          // Actualizar el estado para marcar esta actividad como resuelta
          setResolvedActivities(prev => new Set(prev).add(activity._id));
          return;
        }

        setActivities((prev) => prev.filter((a) => a._id !== activity._id));
        try {
          await activityService.markAsRead(activity._id);
        } catch (error) {
          console.error('Error al marcar actividad como leída:', error);
        }

        navigate('/admin/pacientes', {
          state: {
            openFrequencyRequest: {
              patientId: String(patientId),
              requestId: pendingRequest.id,
            },
          },
        });
      } catch (error) {
        console.error('Error al validar solicitud:', error);
        toast.error('No se pudo validar la solicitud');
      }
    } else if (activity.type === 'PATIENT_DISCHARGE_REQUEST') {
      const patientId = activity.metadata?.patientId ? String(activity.metadata.patientId) : null;
      if (!patientId) {
        toast.error('No se encontró información del paciente para esta solicitud. Por favor, contacte al administrador.');
        return;
      }

      try {
        const requests = await statusRequestService.getPendingRequests();
        const pendingRequest = requests.find((r) => 
          String(r.patientId) === String(patientId) && 
          r.requestedStatus === 'inactive' && 
          r.type !== 'activation'
        );

        if (!pendingRequest) {
          toast.error('La solicitud ya fue resuelta');
          setResolvedActivities(prev => new Set(prev).add(activity._id));
          return;
        }

        setActivities((prev) => prev.filter((a) => a._id !== activity._id));
        try {
          await activityService.markAsRead(activity._id);
        } catch (error) {
          console.error('Error al marcar actividad como leída:', error);
        }

        navigate('/admin/pacientes', {
          state: {
            openStatusRequest: {
              patientId: String(patientId),
              requestId: pendingRequest.id,
            },
          },
        });
      } catch (error) {
        console.error('Error al validar solicitud:', error);
        toast.error('No se pudo validar la solicitud');
      }
    } else if (activity.type === 'PATIENT_ACTIVATION_REQUEST') {
      const patientId = activity.metadata?.patientId ? String(activity.metadata.patientId) : null;
      if (!patientId) {
        toast.error('No se encontró información del paciente para esta solicitud. Por favor, contacte al administrador.');
        return;
      }

      try {
        const requests = await statusRequestService.getPendingRequests();
        const pendingRequest = requests.find((r) => 
          String(r.patientId) === String(patientId) && 
          r.type === 'activation' &&
          r.requestedStatus === 'active'
        );

        if (!pendingRequest) {
          toast.error('La solicitud ya fue resuelta');
          setResolvedActivities(prev => new Set(prev).add(activity._id));
          return;
        }

        setActivities((prev) => prev.filter((a) => a._id !== activity._id));
        try {
          await activityService.markAsRead(activity._id);
        } catch (error) {
          console.error('Error al marcar actividad como leída:', error);
        }

        navigate('/admin/pacientes', {
          state: {
            openActivationRequest: {
              patientId: String(patientId),
              requestId: pendingRequest.id,
            },
          },
        });
      } catch (error) {
        console.error('Error al validar solicitud:', error);
        toast.error('No se pudo validar la solicitud');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 mt-16 space-y-8">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Panel de Control
            </h1>
            <p className="mt-1 text-gray-600">
              Bienvenido, {user?.name}
            </p>
          </div>
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
          <button 
            onClick={handleRefresh}
            className={`flex items-center px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors ${isRefreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isRefreshing}
          >
            <ArrowPathIcon className={`h-5 w-5 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Actualizar datos
          </button>
        </div>

        {statsError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600">{statsError}</p>
            <button
              onClick={loadStats}
              className="mt-2 text-sm text-blue-600 hover:text-blue-700"
            >
              Reintentar carga
            </button>
          </div>
        )}

        {user?.role === 'admin' && systemStats && (
          <>
            {/* Estadísticas Principales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  title: "Usuarios Totales",
                  value: systemStats.users.total,
                  detail: `${systemStats.users.active} activos`,
                  icon: UserGroupIcon,
                  color: "blue"
                },
                {
                  title: "Pacientes",
                  value: systemStats.patients.total,
                  detail: `${systemStats.patients.active} activos`,
                  icon: UserIcon,
                  color: "green"
                },
                {
                  title: "Posts Publicados",
                  value: systemStats.posts.published,
                  detail: `${systemStats.posts.totalViews} vistas`,
                  icon: DocumentTextIcon,
                  color: "purple"
                },
                {
                  title: "Citas Próximas",
                  value: systemStats.appointments.upcoming,
                  detail: `${systemStats.appointments.completed} completadas`,
                  icon: CalendarIcon,
                  color: "yellow",
                  onClick: () => navigate('/professional/calendario')
                }
              ].map((stat, index) => (
              <div 
                  key={`stat-${index}`} 
                  className={`rounded-xl p-[1px] bg-gradient-to-br from-[#7cc7d1] to-[#43aeb8] cursor-pointer transition-all hover:shadow-lg`}
                  onClick={stat.onClick}
                >
                  <div className="bg-white rounded-[11px] p-6">
                    <div className="flex items-center">
                      <div className="bg-primary/10 p-3 rounded-lg">
                        <stat.icon className="h-6 w-6 text-primary" />
                      </div>
                      <div className="ml-4">
                        <h3 className="text-2xl font-bold text-gray-900">{stat.value}</h3>
                        <p className="text-sm text-gray-600">{stat.title}</p>
                        <p className="text-xs text-primary mt-1">{stat.detail}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Secciones de Gestión */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  title: "Gestión de Personal",
                  icon: BriefcaseIcon,
                  color: "blue",
                  route: "/admin/usuarios",
                  stats: [
                    { label: "Profesionales", value: systemStats.users.byRole.professional },
                    { label: "Gestores de Contenido", value: systemStats.users.byRole.content_manager },
                    { label: "Administradores", value: systemStats.users.byRole.admin }
                  ]
                },
                {
                  title: "Gestión de Contenido",
                  icon: NewspaperIcon,
                  color: "purple",
                  route: "/admin/contenido",
                  stats: [
                    { label: "Posts Publicados", value: systemStats.posts.published },
                    { label: "Borradores", value: systemStats.posts.drafts },
                    { label: "Comentarios", value: systemStats.posts.comments }
                  ]
                },
                {
                  title: "Gestión de Pacientes",
                  icon: ClipboardDocumentListIcon,
                  color: "green",
                  route: "/admin/pacientes",
                  stats: [
                    { label: "Pacientes con Citas", value: systemStats.patients.withAppointments },
                    { label: "Profesionales Asignados", value: Object.keys(systemStats.patients.byProfessional).length },
                    { label: "Pacientes Activos", value: systemStats.patients.active }
                  ]
                },
                {
                  title: "Gestión de Finanzas",
                  icon: CurrencyDollarIcon,
                  color: "emerald",
                  route: "/financial",
                  stats: [
                    { label: "Pagos Pendientes", value: financialMetrics.pagosPendientes },
                    { label: "Solicitudes", value: financialMetrics.cantidadSolicitudes },
                    { label: "Ingresos del Mes", value: financialMetrics.ingresosDelMes }
                  ]
                }
              ].map((section, index) => (
                <div 
                  key={`section-${index}`}
                  onClick={() => navigate(section.route)}
                  className="bg-[#F9FAFB] rounded-xl shadow-md p-6 hover:shadow-lg transition-all duration-200 cursor-pointer border border-[#E5E7EB]"
                >
                  <div className="flex items-center mb-4">
                    <div className="bg-primary/10 p-3 rounded-xl">
                      <section.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="ml-4 text-lg font-semibold text-gray-900">
                      {section.title}
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {section.stats.map((stat, statIndex) => (
                      <div key={`stat-${index}-${statIndex}`} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{stat.label}</span>
                        <span className="font-medium text-gray-900">{stat.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Accesos Rápidos */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  title: "Reportes",
                  description: "Estadísticas y análisis",
                  icon: PresentationChartLineIcon,
                  route: '/admin/reportes'
                },
                {
                  title: "Blog",
                  description: "Gestión de contenidos",
                  icon: BookOpenIcon,
                  route: '/admin/contenido'
                },
                {
                  title: "Mensajes",
                  description: "Mensajes de contacto",
                  icon: ChatBubbleLeftRightIcon,
                  route: '/admin/mensajes'
                },
                {
                  title: "Actividad",
                  description: "Registro de acciones",
                  icon: ChartBarIcon,
                  route: '/admin/actividad'
                }
              ].map((card, index) => (
                <QuickAccessCard
                  key={`quick-access-${index}`}
                  title={card.title}
                  description={card.description}
                  icon={card.icon}
                  onClick={() => navigate(card.route)}
                />
              ))}
            </div>

            {/* Actividad Reciente y Últimos Mensajes */}
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Solicitudes de Baja de Pacientes */}
              <div className="bg-[#F9FAFB] rounded-xl shadow-lg p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Notificaciones del sistema</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Mostrando las {MAX_ACTIVITIES} solicitudes más recientes
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/admin/actividad')}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Ver todo
                  </button>
                </div>
                <div className="space-y-4">
                  {activityError ? (
                    <div key="activity-error" className="text-center py-4">
                      <p className="text-red-600">{activityError}</p>
                      <button
                        onClick={loadActivities}
                        className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                      >
                        Reintentar
                      </button>
                    </div>
                  ) : activities.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-gray-500">No hay notificaciones pendientes</p>
                    </div>
                  ) : (
                    activities.map((activity) => {
                      const translated = translateActivity(activity);
                      const isFrequencyRequest =
                        translated.type === 'FREQUENCY_CHANGE_REQUEST' ||
                        translated.type === 'FREQUENCY_CHANGE_REQUESTED';
                      const isStatusRequest =
                        translated.type === 'PATIENT_DISCHARGE_REQUEST' ||
                        translated.type === 'PATIENT_ACTIVATION_REQUEST';
                      const isClickable = isFrequencyRequest || isStatusRequest;
                      const isResolved = resolvedActivities.has(translated._id);

                      return (
                        <ActivityItem
                          key={translated._id}
                          color="bg-red-500"
                          text={translated.description}
                          time={formatTimeAgo(new Date(translated.date))}
                          onClick={isClickable ? () => handleActivityClick(translated) : undefined}
                          isResolved={isResolved}
                        />
                      );
                    })
                  )}
                </div>
              </div>

              {/* Últimos Mensajes */}
              <div className="bg-[#F9FAFB] rounded-xl shadow-lg p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Últimos Mensajes
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Mostrando los {MAX_MESSAGES} mensajes más recientes
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/admin/mensajes')}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Ver todos
                  </button>
                </div>
                <div className="space-y-4">
                  {messageError ? (
                    <div key="message-error" className="text-center py-4">
                      <p className="text-red-600">{messageError}</p>
                      <button
                        onClick={loadRecentMessages}
                        className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                      >
                        Reintentar
                      </button>
                    </div>
                  ) : recentMessages.length > 0 ? (
                    recentMessages.map((msg) => (
                      <MessageItem
                        key={msg._id}
                        name={`${msg.nombre} ${msg.apellido}`}
                        email={msg.correoElectronico}
                        preview={msg.mensaje}
                        time={formatTimeAgo(new Date(msg.fecha))}
                        isUnread={!msg.leido}
                      />
                    ))
                  ) : (
                    <p key="no-messages" className="text-gray-500 text-center py-4">
                      No hay mensajes recientes
                    </p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <ChangePasswordModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={changePassword}
      />
    </div>
  );
};

interface QuickAccessCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  onClick: () => void;
}

const QuickAccessCard: React.FC<QuickAccessCardProps> = ({ title, description, icon: Icon, onClick }) => (
  <div
    onClick={onClick}
    className="bg-[#F9FAFB] rounded-xl shadow-sm p-6 hover:shadow-md transition-all duration-200 cursor-pointer border border-[#E5E7EB]"
  >
    <div className="flex items-center">
      <div className="bg-primary/10 p-3 rounded-xl">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <div className="ml-4">
        <h3 className="text-sm font-medium text-gray-900">{title}</h3>
        <p className="text-xs text-gray-500 mt-1">{description}</p>
      </div>
    </div>
  </div>
);

interface ActivityItemProps {
  color: string;
  text: string;
  time: string;
  onClick?: () => Promise<void> | void;
  isResolved?: boolean;
}

const ActivityItem: React.FC<ActivityItemProps> = ({ color, text, time, onClick, isResolved = false }) => {
  const [isDisabled, setIsDisabled] = useState(isResolved);

  const handleClick = async () => {
    if (!onClick || isDisabled) return;

    setIsDisabled(true);
    try {
      await onClick();
    } catch (error) {
      console.error('Error al gestionar actividad:', error);
      setIsDisabled(false);
    }
  };

  return (
    <div className="flex items-center bg-[#F9FAFB] rounded-lg p-4 shadow-sm">
      <div className={`w-2 h-2 ${color} rounded-full mr-3`}></div>
      <span className="text-gray-600 flex-grow text-sm">{text}</span>
      <div className="flex items-center gap-3">
        {onClick && (
          <button
            onClick={handleClick}
            disabled={isDisabled}
            className={`text-xs font-semibold ${isDisabled ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-800'}`}
            title={isDisabled ? 'La solicitud ya fue resuelta' : 'Gestionar la solicitud'}
          >
            {isDisabled ? 'Resuelto' : 'Gestionar'}
          </button>
        )}
        <span className="text-xs text-gray-400 whitespace-nowrap">{time}</span>
      </div>
    </div>
  );
};

const MessageItem: React.FC<{
  name: string;
  email: string;
  preview: string;
  time: string;
  isUnread?: boolean;
}> = ({ name, email, preview, time, isUnread }) => (
  <div className={`p-4 rounded-lg ${isUnread ? 'bg-blue-50' : 'bg-gray-50'}`}>
    <div className="flex justify-between items-start mb-2">
      <div>
        <h4 className="text-sm font-medium text-gray-900">{name}</h4>
        <p className="text-xs text-gray-500">{email}</p>
      </div>
      <span className="text-xs text-gray-400">{time}</span>
    </div>
    <p className="text-sm text-gray-600 line-clamp-1">{preview}</p>
    {isUnread && (
      <div className="mt-2 flex items-center">
        <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
        <span className="ml-2 text-xs text-blue-600 font-medium">Nuevo mensaje</span>
      </div>
    )}
  </div>
);

const formatTimeAgo = (date: Date) => {
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  
  if (diffInHours < 1) {
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    return `Hace ${diffInMinutes} minutos`;
  } else if (diffInHours < 24) {
    return `Hace ${diffInHours} horas`;
  } else {
    const diffInDays = Math.floor(diffInHours / 24);
    return `Hace ${diffInDays} días`;
  }
};

export default Dashboard;