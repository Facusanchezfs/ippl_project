const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const multer = require('multer');
const logger = require('../utils/logger');
const { sendSuccess, sendError } = require('../utils/response');

// Cambiado: ahora guarda en uploads/carousel en lugar de public/images/carousel
const carouselDir = path.join(__dirname, '../../uploads/carousel');

async function ensureCarouselDir() {
  try {
    await fsp.mkdir(carouselDir, { recursive: true });
  } catch (e) {
    logger.error('No se pudo crear el directorio del carrusel:', e);
  }
}
ensureCarouselDir();

// Multer config: guarda directamente en /public/images/carousel
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, carouselDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/\s+/g, '-');
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${base}-${unique}${ext}`);
  },
});

const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const ok = imageExtensions.has(ext) || file.mimetype.startsWith('image/');
  if (!ok) return cb(new Error('Solo se permiten imágenes'), false);
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB c/u
});

// === GET: listar imágenes del carrusel ===
const getCarouselImages = (req, res) => {
  fs.readdir(carouselDir, (err, files) => {
    if (err) {
      logger.error('Error al leer el directorio del carrusel:', err);
      return sendError(res, 500, 'No se pudieron cargar las imágenes del carrusel.');
    }
    const imageFiles = files.filter((f) => imageExtensions.has(path.extname(f).toLowerCase()));
    return sendSuccess(res, imageFiles);
  });
};

// === DELETE: eliminar imagen del carrusel ===
const deleteCarouselImage = (req, res) => {
  const { filename } = req.params;

  if (!filename || filename.includes('..') || filename.includes('/')) {
    return sendError(res, 400, 'Nombre de archivo no válido.');
  }

  const filePath = path.join(carouselDir, filename);

  fs.unlink(filePath, (err) => {
    if (err) {
      logger.error(`Error al eliminar el archivo ${filename}:`, err);
      if (err.code === 'ENOENT') {
        return sendError(res, 404, 'El archivo no fue encontrado.');
      }
      return sendError(res, 500, 'Error al eliminar la imagen.');
    }
    return sendSuccess(res, null, `Imagen '${filename}' eliminada correctamente.`, 204);
  });
};

// === POST: subir imágenes del carrusel ===
// Usar con upload.array('images', 10)
const uploadCarouselImages = (req, res) => {
  if (!req.files || req.files.length === 0) {
    return sendError(res, 400, 'No se recibieron imágenes del carrusel.');
  }

  const uploadedFiles = req.files.map((f) => f.filename);
  return sendSuccess(res, { files: uploadedFiles }, 'Imágenes subidas correctamente.', 201);
};

module.exports = {
  upload,                 // << exporto el middleware de multer
  getCarouselImages,
  deleteCarouselImage,
  uploadCarouselImages,
};
