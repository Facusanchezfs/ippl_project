// Utilidades para manejar mensajes de error amigables

export interface ErrorResponse {
  message?: string;
  status?: number;
  data?: any;
}

/**
 * Obtiene un mensaje de error amigable basado en el tipo de error
 */
export const getFriendlyErrorMessage = (error: any, defaultMessage: string = 'Ocurrió un error inesperado'): string => {
  // Log del error completo para desarrolladores
  console.error('Error completo:', error);

  // Si es un error de red/conexión
  if (!error.response) {
    return 'No se pudo conectar con el servidor. Verifica tu conexión a internet.';
  }

  const status = error.response?.status;
  const message = error.response?.data?.message;

  // Errores específicos por código de estado
  switch (status) {
    case 400:
      return message || 'Los datos enviados no son válidos. Por favor, revisa la información.';
    
    case 401:
      return 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.';
    
    case 403:
      return 'No tienes permisos para realizar esta acción.';
    
    case 404:
      return 'El recurso solicitado no fue encontrado.';
    
    case 409:
      return message || 'Ya existe un registro con esta información.';
    
    case 422:
      return message || 'Los datos enviados no cumplen con los requisitos.';
    
    case 500:
      return 'Error interno del servidor. Por favor, intenta nuevamente en unos minutos.';
    
    case 503:
      return 'El servicio no está disponible temporalmente. Por favor, intenta más tarde.';
    
    default:
      // Si hay un mensaje específico del servidor, usarlo
      if (message) {
        return message;
      }
      
      // Mensaje genérico amigable
      return defaultMessage;
  }
};

/**
 * Mensajes específicos para diferentes operaciones
 */
export const ErrorMessages = {
  // Autenticación
  LOGIN_FAILED: 'Email o contraseña incorrectos. Verifica tus credenciales.',
  SESSION_EXPIRED: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.',
  UNAUTHORIZED: 'No tienes permisos para realizar esta acción.',
  
  // Usuarios
  USER_CREATE_FAILED: 'No se pudo crear el usuario. Verifica que todos los campos estén completos.',
  USER_UPDATE_FAILED: 'No se pudo actualizar el usuario. Intenta nuevamente.',
  USER_DELETE_FAILED: 'No se pudo eliminar el usuario. Intenta nuevamente.',
  USER_LOAD_FAILED: 'No se pudieron cargar los usuarios. Intenta recargar la página.',
  
  // Contraseñas
  PASSWORD_CHANGE_FAILED: 'No se pudo cambiar la contraseña. Intenta nuevamente.',
  PASSWORD_INVALID: 'La contraseña actual no es correcta.',
  
  // Citas
  APPOINTMENT_CREATE_FAILED: 'No se pudo crear la cita. Verifica que todos los campos estén completos.',
  APPOINTMENT_UPDATE_FAILED: 'No se pudo actualizar la cita. Intenta nuevamente.',
  APPOINTMENT_DELETE_FAILED: 'No se pudo eliminar la cita. Intenta nuevamente.',
  APPOINTMENT_LOAD_FAILED: 'No se pudieron cargar las citas. Intenta recargar la página.',
  
  // Pacientes
  PATIENT_CREATE_FAILED: 'No se pudo crear el paciente. Verifica que todos los campos estén completos.',
  PATIENT_UPDATE_FAILED: 'No se pudo actualizar el paciente. Intenta nuevamente.',
  PATIENT_DELETE_FAILED: 'No se pudo eliminar el paciente. Intenta nuevamente.',
  PATIENT_LOAD_FAILED: 'No se pudieron cargar los pacientes. Intenta recargar la página.',
  
  // Posts/Blog
  POST_CREATE_FAILED: 'No se pudo crear el post. Verifica que todos los campos estén completos.',
  POST_UPDATE_FAILED: 'No se pudo actualizar el post. Intenta nuevamente.',
  POST_DELETE_FAILED: 'No se pudo eliminar el post. Intenta nuevamente.',
  POST_LOAD_FAILED: 'No se pudieron cargar los posts. Intenta recargar la página.',
  
  // Archivos/Imágenes
  FILE_UPLOAD_FAILED: 'No se pudo subir el archivo. Verifica que el archivo sea válido.',
  FILE_DELETE_FAILED: 'No se pudo eliminar el archivo. Intenta nuevamente.',
  IMAGE_LOAD_FAILED: 'No se pudo cargar la imagen. Intenta recargar la página.',
  
  // Red/Conectividad
  NETWORK_ERROR: 'No se pudo conectar con el servidor. Verifica tu conexión a internet.',
  SERVER_ERROR: 'Error interno del servidor. Por favor, intenta nuevamente en unos minutos.',
  TIMEOUT_ERROR: 'La operación tardó demasiado. Intenta nuevamente.',
  
  // Validaciones
  REQUIRED_FIELDS: 'Por favor, completa todos los campos requeridos.',
  INVALID_EMAIL: 'El email ingresado no es válido.',
  INVALID_DATE: 'La fecha ingresada no es válida.',
  INVALID_TIME: 'La hora ingresada no es válida.',
  
  // Genéricos
  UNKNOWN_ERROR: 'Ocurrió un error inesperado. Por favor, intenta nuevamente.',
  TRY_AGAIN: 'Algo salió mal. Por favor, intenta nuevamente.',
  CONTACT_SUPPORT: 'Si el problema persiste, contacta al administrador del sistema.'
};

/**
 * Hook para manejar errores de forma consistente
 */
export const useErrorHandler = () => {
  const handleError = (error: any, customMessage?: string) => {
    const friendlyMessage = getFriendlyErrorMessage(error, customMessage);
    return friendlyMessage;
  };

  return { handleError };
};
