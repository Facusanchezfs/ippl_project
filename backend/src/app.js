const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const { globalLimiter, writeLimiter } = require('./middleware/rateLimiter');
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
	contentSecurityPolicy: {
		directives: {
			defaultSrc: ["'self'"],
			scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // unsafe-eval necesario para Vite en desarrollo
			styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind puede generar estilos inline
			imgSrc: isProduction
				? ["'self'", "data:", "https://images.pexels.com", "https://via.placeholder.com"]
				: ["'self'", "data:", "http://localhost:5000", "https://images.pexels.com", "https://via.placeholder.com"],
			fontSrc: ["'self'", "data:"],
			connectSrc: isProduction
				? ["'self'", "http://localhost:5000", "https://www.ippl.com.ar"]
				: ["'self'", "http://localhost:5000", "http://localhost:5173", "https://www.ippl.com.ar"],
			frameSrc: ["'self'", "https://www.google.com", "https://www.youtube.com"],
			objectSrc: ["'none'"],
			baseUri: ["'self'"],
			formAction: ["'self'"],
			frameAncestors: ["'none'"], // Previene clickjacking
			upgradeInsecureRequests: isProduction ? [] : null, // Solo en producción
		},
	},
	// Forzar HTTPS en producción
	strictTransportSecurity: {
		maxAge: 31536000, // 1 año
		includeSubDomains: true,
		preload: true
	},
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
    console.log(`Created directory: ${dir}`);
  }
});

// Configurar middleware para servir archivos estáticos desde /uploads
// Manejar diferentes tipos de archivos (audio, imágenes, etc.)
app.use('/uploads', (req, res, next) => {
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
  
  next();
}, express.static(path.join(__dirname, '..', 'uploads'), {
  setHeaders: (res, filePath) => {
    const extension = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.webm': 'audio/webm',
      '.ogg': 'audio/ogg',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav'
    };
    
    if (mimeTypes[extension]) {
      res.setHeader('Content-Type', mimeTypes[extension]);
      res.setHeader('Accept-Ranges', 'bytes');
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

// Manejo de errores
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

module.exports = app; 