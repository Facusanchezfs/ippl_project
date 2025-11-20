const express = require('express');
const router = express.Router();
const fsSync = require('fs');
const path = require('path');
const multer = require('multer');
const { verifyToken } = require('../controllers/authController');
const postController = require('../controllers/postController');

// Asegurar que existan los directorios necesarios
const createRequiredDirectories = () => {
  const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
  const postsDir = path.join(uploadsDir, 'posts');
  
  if (!fsSync.existsSync(uploadsDir)) {
    fsSync.mkdirSync(uploadsDir, { recursive: true });
  }
  if (!fsSync.existsSync(postsDir)) {
    fsSync.mkdirSync(postsDir, { recursive: true });
  }
};

// Crear directorios al iniciar
createRequiredDirectories();

// Configuración de multer para subida de imágenes
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '..', '..', 'uploads', 'posts');
    // Asegurar que el directorio existe antes de cada upload
    if (!fsSync.existsSync(uploadPath)) {
      fsSync.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

const validate = require('../middleware/validate');
const postValidators = require('../validators/postValidator');

// Middleware para verificar si el parámetro es una sección válida
const checkIfSection = (req, res, next) => {
  const validSections = ['ninos', 'adultos', 'noticias'];
  const param = req.params.section || req.params.id;
  
  // Si el parámetro es una sección válida, renombrarlo a 'section' y continuar
  if (validSections.includes(param)) {
    req.params.section = param;
    delete req.params.id; // Eliminar id si existe
    return next();
  }
  
  // Si no es una sección válida, pasar a la siguiente ruta
  return next('route');
};

// Rutas públicas
router.get('/', postController.getAllPosts);
router.get('/slug/:slug', validate(postValidators.getBySlug), postController.getPostBySlug);
// IMPORTANTE: Esta ruta debe ir ANTES de /:id para que Express la capture primero
// Solo se ejecuta si el parámetro es una sección válida (ninos, adultos, noticias)
router.get('/:section', [checkIfSection, validate(postValidators.getBySection), postController.getPostBySection]);
router.post('/:id/increment-view', postController.incrementPostView);
// Toggle like de un post
router.post('/:id/toggle-like', postController.togglePostLike);

// Rutas protegidas
router.use(verifyToken);
router.post('/', upload.single('thumbnail'), validate(postValidators.create), postController.createPost);

// Obtener un post por ID (solo se ejecuta si no coincide con las rutas anteriores)
router.get('/:id', validate(postValidators.getById), postController.getPostById);

router.put('/:id', upload.single('thumbnail'), validate(postValidators.update), postController.updatePost);

router.delete('/:id', validate(postValidators.delete), postController.deletePost);

// Verificar si un usuario ha visto un post
router.get('/:id/check-view', validate(postValidators.getById), postController.checkPostViewed);

// Verificar si un usuario ha dado like a un post
router.get('/:id/check-like', validate(postValidators.getById), postController.checkPostLike);

// Obtener estadísticas generales
router.get('/stats', verifyToken, postController.getPostsStats);

module.exports = router; 