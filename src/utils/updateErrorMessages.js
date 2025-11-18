// Script para actualizar mensajes de error en todo el proyecto
// Este es un script de Node.js que se puede ejecutar para actualizar automáticamente los mensajes

const fs = require('fs');
const path = require('path');

// Mapeo de mensajes de error comunes a mensajes amigables
const errorMappings = {
  // Errores de red/conexión
  'No se pudo conectar con el servidor': 'No se pudo conectar con el servidor. Verifica tu conexión a internet.',
  'Error de red': 'No se pudo conectar con el servidor. Verifica tu conexión a internet.',
  'Network Error': 'No se pudo conectar con el servidor. Verifica tu conexión a internet.',
  
  // Errores de autenticación
  'Error al iniciar sesión': 'Email o contraseña incorrectos. Verifica tus credenciales.',
  'Credenciales inválidas': 'Email o contraseña incorrectos. Verifica tus credenciales.',
  'Unauthorized': 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.',
  
  // Errores de validación
  'Error de validación': 'Los datos enviados no son válidos. Por favor, revisa la información.',
  'Datos inválidos': 'Los datos enviados no son válidos. Por favor, revisa la información.',
  
  // Errores de permisos
  'No tienes permisos': 'No tienes permisos para realizar esta acción.',
  'Forbidden': 'No tienes permisos para realizar esta acción.',
  
  // Errores de servidor
  'Error interno del servidor': 'Error interno del servidor. Por favor, intenta nuevamente en unos minutos.',
  'Error 500': 'Error interno del servidor. Por favor, intenta nuevamente en unos minutos.',
  
  // Errores de archivos
  'Error al subir': 'No se pudo subir el archivo. Verifica que el archivo sea válido.',
  'Error al cargar': 'No se pudieron cargar los datos. Intenta recargar la página.',
  
  // Errores genéricos
  'Error inesperado': 'Ocurrió un error inesperado. Por favor, intenta nuevamente.',
  'Algo salió mal': 'Algo salió mal. Por favor, intenta nuevamente.',
};

// Función para actualizar un archivo
function updateFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let updated = false;
    
    // Buscar y reemplazar mensajes de error
    Object.entries(errorMappings).forEach(([oldMessage, newMessage]) => {
      const regex = new RegExp(`toast\\.error\\('${oldMessage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'\\)`, 'g');
      if (content.match(regex)) {
        content = content.replace(regex, `toast.error('${newMessage}')`);
        updated = true;
      }
    });
    
    if (updated) {
      fs.writeFileSync(filePath, content, 'utf8');
    }
  } catch (error) {
    console.error(`❌ Error al procesar ${filePath}:`, error.message);
  }
}

// Función para recorrer directorios recursivamente
function walkDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      walkDirectory(filePath);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      updateFile(filePath);
    }
  });
}

// Ejecutar el script
walkDirectory('./src');
