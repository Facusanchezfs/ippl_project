const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const multer = require('multer');

// Cambiado: ahora guarda en uploads/carousel en lugar de public/images/carousel
const carouselDir = path.join(__dirname, '../../uploads/carousel');

async function ensureCarouselDir() {
  try {
    await fsp.mkdir(carouselDir, { recursive: true });
  } catch (e) {
    console.error('No se pudo crear el directorio del carrusel:', e);
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
      console.error('Error al leer el directorio del carrusel:', err);
      return res
        .status(500)
        .json({ message: 'No se pudieron cargar las imágenes del carrusel.' });
    }
    const imageFiles = files.filter((f) => imageExtensions.has(path.extname(f).toLowerCase()));
    // si querés devolver URLs absolutas:
    // const base = `${req.protocol}://${req.get('host')}`;
    // const urls = imageFiles.map((f) => `${base}/images/carousel/${f}`);
    // return res.status(200).json(urls);

    return res.status(200).json(imageFiles);
  });
};

// === DELETE: eliminar imagen del carrusel ===
const deleteCarouselImage = (req, res) => {
  const { filename } = req.params;

  if (!filename || filename.includes('..') || filename.includes('/')) {
    return res.status(400).json({ message: 'Nombre de archivo no válido.' });
  }

  const filePath = path.join(carouselDir, filename);

  fs.unlink(filePath, (err) => {
    if (err) {
      console.error(`Error al eliminar el archivo ${filename}:`, err);
      if (err.code === 'ENOENT') {
        return res.status(404).json({ message: 'El archivo no fue encontrado.' });
      }
      return res.status(500).json({ message: 'Error al eliminar la imagen.' });
    }
    return res.status(200).json({ message: `Imagen '${filename}' eliminada correctamente.` });
  });
};

// === POST: subir imágenes del carrusel ===
// Usar con upload.array('images', 10)
const uploadCarouselImages = (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res
      .status(400)
      .json({ message: 'No se recibieron imágenes del carrusel.' });
  }

  const uploadedFiles = req.files.map((f) => f.filename);
  // si querés devolver URLs absolutas:
  // const base = `${req.protocol}://${req.get('host')}`;
  // const urls = req.files.map((f) => `${base}/images/carousel/${f.filename}`);

  return res.status(201).json({
    message: 'Imágenes subidas correctamente.',
    files: uploadedFiles,
    // urls,
  });
};

module.exports = {
  upload,                 // << exporto el middleware de multer
  getCarouselImages,
  deleteCarouselImage,
  uploadCarouselImages,
};
