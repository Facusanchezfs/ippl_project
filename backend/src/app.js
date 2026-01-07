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
const derivationsRouter = require('./routes/derivations');
const reportsRouter = require('./routes/reports');

const app = express();

app.set('trust proxy', 1);

const isProduction = process.env.NODE_ENV === 'production';

app.use(helmet({
	contentSecurityPolicy: isProduction ? {
		directives: {
			defaultSrc: ["'self'"],
			scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
			styleSrc: ["'self'", "'unsafe-inline'"],
			imgSrc: ["'self'", "data:", "blob:", "*"],
			mediaSrc: ["'self'", "blob:", "https://ippl.com.ar", "https://www.ippl.com.ar"],
			fontSrc: ["'self'", "data:"],
			connectSrc: ["*"],
			frameSrc: ["'self'", "https://www.google.com", "https://www.youtube.com"],
			objectSrc: ["'none'"],
			baseUri: ["'self'"],
			formAction: ["'self'"],
			frameAncestors: ["'none'"],
			upgradeInsecureRequests: [],
		},
	} : {
		directives: {
			defaultSrc: ["'self'"],
			scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
			styleSrc: ["'self'", "'unsafe-inline'"],
			imgSrc: ["'self'", "data:", "blob:", "*"],
			mediaSrc: ["'self'", "blob:"],
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
	strictTransportSecurity: isProduction ? {
		maxAge: 31536000,
		includeSubDomains: true,
		preload: true
	} : false,
	crossOriginOpenerPolicy: isProduction ? { policy: "same-origin" } : false,
	crossOriginResourcePolicy: false,
	noSniff: true,
	frameguard: {
		action: 'deny'
	},
	hidePoweredBy: true,
	xssFilter: true,
}));

app.use(express.static(path.join(__dirname, '../../public')));

const allowedOrigins = [
	'http://localhost:5173',
	'https://www.ippl.com.ar'
];

app.use(cors({
	origin: (origin, callback) => {
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

app.use(requestLogger);

app.use('/api', globalLimiter);

app.use('/api', writeLimiter);

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

app.use('/uploads', (req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  
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
    res.setHeader('Cache-Control', 'public, max-age=31536000');
  }
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
}, express.static(path.join(__dirname, '..', 'uploads'), {
  setHeaders: (res, filePath) => {
    const extension = path.extname(filePath).toLowerCase();
    
    const audioMimeTypes = {
      '.webm': 'audio/webm',
      '.ogg': 'audio/ogg',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav'
    };
    
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
app.use('/api/derivations', derivationsRouter);
app.use('/api/admin/reports', reportsRouter);

app.use(errorLogger);

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  res.status(500).json({ 
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

module.exports = app; 