const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const { globalLimiter, writeLimiter } = require('./middleware/rateLimiter');
const requestLogger = require('./middleware/requestLogger');
const errorLogger = require('./middleware/errorLogger');
const logger = require('./utils/logger');
const appointmentsRouter = require('./routes/appointments');
const usersRouter = require('./routes/users');
const uploadRouter = require('./routes/upload');
const postsRouter = require('./routes/posts');
const professionalsRouter = require('./routes/professionals');
const messagesRouter = require('./routes/messageRoutes');
const statsRoutes = require('./routes/stats');
const contentRoutes = require('./routes/content');
const statusRequestsRoutes = require('./routes/statusRequests');
const frequencyRequestsRoutes = require('./routes/frequencyRequests');
const medicalHistoryRouter = require('./routes/medicalHistory');
const activitiesRouter = require('./routes/activities');
const paymentsRouter = require('./routes/payments');

const app = express();

// Configurar trust proxy para rate limiting detrás de proxy/reverse proxy
// express-rate-limit v8 requiere que esto se configure en Express, no en el limiter
app.set('trust proxy', 1);

// Configurar headers de seguridad con Helmet
// Configuración diferente para development y production
const isProduction = process.env.NODE_ENV === 'production';

app.use(helmet({
	contentSecurityPolicy: isProduction ? {
		directives: {
			defaultSrc: ["'self'"],
			scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // unsafe-eval necesario para Vite en desarrollo
			styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind puede generar estilos inline
			imgSrc: ["'self'", "data:", "blob:", "*"], // Permitir imágenes desde self, data URLs, blob URLs y cualquier origen
			mediaSrc: ["*"], // TEMPORAL: Permitir todos los orígenes para validar que el problema es solo CSP
			fontSrc: ["'self'", "data:"],
			connectSrc: ["*"],
			frameSrc: ["'self'", "https://www.google.com", "https://www.youtube.com"],
			objectSrc: ["'none'"],
			baseUri: ["'self'"],
			formAction: ["'self'"],
			frameAncestors: ["'none'"], // Previene clickjacking
			upgradeInsecureRequests: [],
		},
	} : {
		directives: {
			defaultSrc: ["'self'"],
			scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
			styleSrc: ["'self'", "'unsafe-inline'"],
			imgSrc: ["'self'", "data:", "blob:", "*"], // Permitir imágenes desde self, data URLs, blob URLs y cualquier origen
			mediaSrc: ["'self'", "blob:"], // Permitir audio/video desde self y blob URLs
			fontSrc: ["'self'", "data:"],
			connectSrc: ["*"],
			frameSrc: ["'self'", "https://www.google.com", "https://www.youtube.com"],
			objectSrc: ["'none'"],
			baseUri: ["'self'"],
			formAction: ["'self'"],
			frameAncestors: ["'none'"],
			upgradeInsecureRequests: null,
		},
	},
	// Forzar HTTPS en producción
	strictTransportSecurity: isProduction ? {
		maxAge: 31536000, // 1 año
		includeSubDomains: true,
		preload: true
	} : false,
	// Cross-Origin-Opener-Policy: solo en producción
	crossOriginOpenerPolicy: isProduction ? { policy: "same-origin" } : false,
	// Cross-Origin-Resource-Policy: permitir cross-origin para imágenes y recursos estáticos
	crossOriginResourcePolicy: false, // Deshabilitado para permitir carga de imágenes desde cualquier origen
	// Prevenir MIME type sniffing
	noSniff: true,
	// Prevenir que la página sea embebida en iframes (clickjacking)
	frameguard: {
		action: 'deny'
	},
	// Deshabilitar X-Powered-By header
	hidePoweredBy: true,
	// Configurar XSS Protection
	xssFilter: true,
}));

// Servir archivos estáticos desde la carpeta 'public' en la raíz del proyecto
app.use(express.static(path.join(__dirname, '../../public')));

// Configuración de CORS
const allowedOrigins = [
	'http://localhost:5173',
	'https://www.ippl.com.ar'
];

app.use(cors({
	origin: (origin, callback) => {
		// Permitir requests sin origin (Postman, cURL, etc.)
		if (!origin) return callback(null, true);
		if (allowedOrigins.includes(origin)) {
			return callback(null, true);
		}
		return callback(new Error('Origin not allowed by CORS'));
	},
	credentials: true,
	methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
	allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Middleware de logging de requests (debe ir antes de las rutas)
app.use(requestLogger);

// Aplicar rate limiting global a todas las rutas API
app.use('/api', globalLimiter);

// Aplicar rate limiting adicional a endpoints de escritura
app.use('/api', writeLimiter);

// Asegurar que las carpetas necesarias existen
const uploadsDir = path.join(__dirname, '..', 'uploads');
const audioUploadsDir = path.join(uploadsDir, 'audios');
const postsUploadsDir = path.join(uploadsDir, 'posts');
const carouselUploadsDir = path.join(uploadsDir, 'carousel');
const imagesUploadsDir = path.join(uploadsDir, 'images');

[uploadsDir, audioUploadsDir, postsUploadsDir, carouselUploadsDir, imagesUploadsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    logger.info(`Created directory: ${dir}`);
  }
});

// Configurar middleware para servir archivos estáticos desde /uploads
// Manejar diferentes tipos de archivos (audio, imágenes, etc.)
app.use('/uploads', (req, res, next) => {
  // Agregar headers CORS para permitir carga de imágenes desde cualquier origen
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else if (!origin) {
    // Permitir requests sin origin (navegadores, herramientas, etc.)
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  // Headers adicionales para CORS
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  
  // Manejar diferentes tipos de archivos de audio
  if (req.path.match(/\.(webm|ogg|mp3|wav)$/)) {
    const extension = path.extname(req.path).toLowerCase();
    const mimeTypes = {
      '.webm': 'audio/webm',
      '.ogg': 'audio/ogg',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav'
    };
    
    res.setHeader('Content-Type', mimeTypes[extension]);
    res.setHeader('Accept-Ranges', 'bytes');
  }
  
  // Manejar tipos de imágenes
  if (req.path.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
    const extension = path.extname(req.path).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml'
    };
    
    if (mimeTypes[extension]) {
      res.setHeader('Content-Type', mimeTypes[extension]);
    }
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache de 1 año para imágenes
  }
  
  // Responder a OPTIONS requests (preflight)
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
}, express.static(path.join(__dirname, '..', 'uploads'), {
  setHeaders: (res, filePath) => {
    const extension = path.extname(filePath).toLowerCase();
    
    // MIME types para audio
    const audioMimeTypes = {
      '.webm': 'audio/webm',
      '.ogg': 'audio/ogg',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav'
    };
    
    // MIME types para imágenes
    const imageMimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml'
    };
    
    if (audioMimeTypes[extension]) {
      res.setHeader('Content-Type', audioMimeTypes[extension]);
      res.setHeader('Accept-Ranges', 'bytes');
    } else if (imageMimeTypes[extension]) {
      res.setHeader('Content-Type', imageMimeTypes[extension]);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    }
  }
}));

// Rutas
app.use('/api/appointments', appointmentsRouter);
app.use('/api/users', usersRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/posts', postsRouter);
app.use('/api/professionals', professionalsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/stats', statsRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/status-requests', statusRequestsRoutes);
app.use('/api/frequency-requests', frequencyRequestsRoutes);
app.use('/api/medical-history', medicalHistoryRouter);
app.use('/api/activities', activitiesRouter);
app.use('/api/payments', paymentsRouter);

// Nota: /uploads ya está configurado arriba con middleware para tipos MIME
// Esta línea duplicada se eliminó para evitar conflictos

// Middleware de logging de errores (debe ir antes del manejo de errores final)
app.use(errorLogger);

// Manejo de errores
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  res.status(500).json({ 
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

module.exports = app; 