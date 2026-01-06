const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');
const { sendSuccess, sendError } = require('../utils/response');

async function ensureDirectories() {
  const uploadDir = path.join(__dirname, '../../uploads');
  const audioDir = path.join(uploadDir, 'audios');
  
  try {
    await fs.access(uploadDir);
  } catch {
    await fs.mkdir(uploadDir, { recursive: true });
  }
  
  try {
    await fs.access(audioDir);
  } catch {
    await fs.mkdir(audioDir, { recursive: true });
  }
}

ensureDirectories().catch((err) => logger.error('Error al crear directorios de upload:', err));

const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    await ensureDirectories();
    cb(null, path.join(__dirname, '../../uploads/audios'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${uniqueSuffix}.webm`);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    logger.debug('Tipo de archivo recibido:', { mimetype: file.mimetype });
    if (file.mimetype === 'audio/webm') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permite formato WebM'));
    }
  },
  limits: {
    fileSize: 30 * 1024 * 1024
  }
});

const uploadAudio = upload.single('audio');

router.post(
  '/audio',
  authenticateToken,
  uploadAudio,
  async (req, res) => {
    try {
      if (!req.file) {
        return sendError(res, 400, 'No se proporcionó ningún archivo de audio');
      }

      logger.debug('Archivo recibido:', { filename: req.file.filename, size: req.file.size });

      const audioUrl = `/uploads/audios/${req.file.filename}`;
      
      try {
        await fs.access(path.join(__dirname, '../../uploads/audios', req.file.filename));
        logger.info('Archivo guardado exitosamente:', { url: audioUrl });
      } catch (error) {
        logger.error('Error verificando archivo:', error);
        return sendError(res, 500, 'Error al guardar el archivo de audio', { error: error.message });
      }
      
      return sendSuccess(res, {
        url: audioUrl,
        audioUrl: audioUrl,
        filename: req.file.filename,
        mimetype: req.file.mimetype
      }, 'Audio subido exitosamente');
    } catch (error) {
      logger.error('Error al subir audio:', error);
      return sendError(res, 500, 'Error al subir el archivo de audio', { error: error.message });
    }
  }
);

const carouselDir = path.join(__dirname, '../../uploads/carousel');
async function ensureCarouselDir() {
  try {
    await fs.access(carouselDir);
  } catch {
    await fs.mkdir(carouselDir, { recursive: true });
  }
}

const carouselStorage = multer.diskStorage({
  destination: async function (req, file, cb) {
    await ensureCarouselDir();
    cb(null, carouselDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

const uploadCarousel = multer({
  storage: carouselStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

router.post('/carousel', authenticateToken, uploadCarousel.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return sendError(res, 400, 'No se proporcionó ninguna imagen');
    }
    const imageUrl = `/uploads/carousel/${req.file.filename}`;
    return sendSuccess(res, {
      url: imageUrl,
      filename: req.file.filename,
      mimetype: req.file.mimetype
    }, 'Imagen subida exitosamente');
  } catch (error) {
    logger.error('Error al subir imagen del carousel:', error);
    return sendError(res, 500, 'Error al subir la imagen', { error: error.message });
  }
});

module.exports = router; 