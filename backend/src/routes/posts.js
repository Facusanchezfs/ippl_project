const express = require('express');
const router = express.Router();
const fsSync = require('fs');
const path = require('path');
const multer = require('multer');
const { verifyToken } = require('../controllers/authController');
const postController = require('../controllers/postController');

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

createRequiredDirectories();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '..', '..', 'uploads', 'posts');
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

const checkIfSection = (req, res, next) => {
  const validSections = ['ninos', 'adultos', 'noticias'];
  const param = req.params.section || req.params.id;
  
  if (validSections.includes(param)) {
    req.params.section = param;
    delete req.params.id;
    return next();
  }
  
  return next('route');
};

router.get('/', postController.getAllPosts);
router.get('/slug/:slug', validate(postValidators.getBySlug), postController.getPostBySlug);
router.get('/:section', [checkIfSection, validate(postValidators.getBySection), postController.getPostBySection]);
router.post('/:id/increment-view', postController.incrementPostView);
router.post('/:id/toggle-like', postController.togglePostLike);

router.use(verifyToken);
router.post('/', upload.single('thumbnail'), validate(postValidators.create), postController.createPost);

router.get('/:id', validate(postValidators.getById), postController.getPostById);

router.put('/:id', upload.single('thumbnail'), validate(postValidators.update), postController.updatePost);

router.delete('/:id', validate(postValidators.delete), postController.deletePost);

router.get('/:id/check-view', validate(postValidators.getById), postController.checkPostViewed);

router.get('/:id/check-like', validate(postValidators.getById), postController.checkPostLike);

router.get('/stats', verifyToken, postController.getPostsStats);

module.exports = router; 