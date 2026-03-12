import axios, {
  AxiosHeaders,
  InternalAxiosRequestConfig,
} from 'axios';

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000') + "/api";

// ===== Rutas protegidas =====
const PROTECTED_PREFIXES: string[] = ['/admin', '/financial', '/professional', '/content'];
const isProtectedPath = (pathname: string): boolean =>
  PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

// ===== Helpers JWT =====
function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const [, payloadB64] = token.split('.');
    if (!payloadB64) return null;
    const base64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/'); // <-- typo fix abajo
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function isTokenExpired(token: string, skewSeconds: number = 30): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return true;
  const now = Math.floor(Date.now() / 1000);
  return now >= payload.exp - skewSeconds;
}

const api = axios.create({
  baseURL: BASE_URL,
  headers: new AxiosHeaders({ 'Content-Type': 'application/json' }),
});

// ===== REQUEST interceptor (usar InternalAxiosRequestConfig) =====
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Soporte FormData: dejar que el browser setee el boundary
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      (config.headers as AxiosHeaders).delete('Content-Type');
    }

    const token = localStorage.getItem('token');
    const path = window.location.pathname;
    const inProtected = isProtectedPath(path);

    if (token) {
      if (isTokenExpired(token)) {
        localStorage.removeItem('token');
        if (inProtected && path !== '/login') {
          // cancelar esta request y redirigir
          window.location.replace('/login');
          throw new axios.Cancel('redirect/login (expired token)');
        }
      } else {
        (config.headers as AxiosHeaders).set('Authorization', `Bearer ${token}`);
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ===== RESPONSE interceptor =====
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const path = window.location.pathname;
    const inProtected = isProtectedPath(path);

    // Solo desloguear automáticamente en 401 (no autorizado).
    // Los 403 (prohibido) pueden ser simplemente falta de permisos en un recurso específico
    // y no deben forzar cierre de sesión.
    if (status === 401 && inProtected && path !== '/login') {
      localStorage.removeItem('token');
      window.location.replace('/login');
      return; // cortar la cadena
    }

    return Promise.reject(error);
  }
);

export default api;
