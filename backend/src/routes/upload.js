const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');

// Asegurar que los directorios existan
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

// Crear directorios al iniciar
ensureDirectories().catch((err) => logger.error('Error al crear directorios de upload:', err));

// Configurar multer para almacenar los archivos
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
    fileSize: 10 * 1024 * 1024 // 10MB max
  }
});

const uploadAudio = upload.single('audio');

// Ruta para subir audio
router.post(
  '/audio',
  authenticateToken,
  uploadAudio, // MODIFICADO: uso del middleware named uploadAudio
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          message: 'No se proporcionó ningún archivo de audio',
          success: false 
        });
      }

      logger.debug('Archivo recibido:', { filename: req.file.filename, size: req.file.size });

      // Construir la URL relativa del audio
      const audioUrl = `/uploads/audios/${req.file.filename}`;
      
      // Verificar que el archivo existe y es accesible
      try {
        await fs.access(path.join(__dirname, '../../uploads/audios', req.file.filename));
        logger.info('Archivo guardado exitosamente:', { url: audioUrl });
      } catch (error) {
        logger.error('Error verificando archivo:', error);
        return res.status(500).json({ 
          message: 'Error al guardar el archivo de audio',
          success: false,
          error: error.message
        });
      }
      
      // Enviar respuesta con URL y filename
      res.json({
        message: 'Audio subido exitosamente',
        success: true,
        url: audioUrl,
        audioUrl: audioUrl,
        filename: req.file.filename,
        mimetype: req.file.mimetype
      });
    } catch (error) {
      logger.error('Error al subir audio:', error);
      res.status(500).json({ 
        message: 'Error al subir el archivo de audio',
        success: false,
        error: error.message 
      });
    }
  }
);

// --- Carrusel de imágenes ---
// Cambiado: ahora guarda en uploads/carousel en lugar de public/images/carousel
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
    fileSize: 10 * 1024 * 1024 // 10MB max
  }
});

router.post('/carousel', authenticateToken, uploadCarousel.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No se proporcionó ninguna imagen', success: false });
    }
    // Cambiado: ahora devuelve /uploads/carousel/ en lugar de /images/carousel/
    const imageUrl = `/uploads/carousel/${req.file.filename}`;
    res.json({
      message: 'Imagen subida exitosamente',
      success: true,
      url: imageUrl,
      filename: req.file.filename,
      mimetype: req.file.mimetype
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al subir la imagen', success: false, error: error.message });
  }
});

module.exports = router; 