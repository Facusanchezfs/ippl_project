const express = require('express');
const router = express.Router();
const contentController = require('../controllers/contentController');
const { authenticateToken } = require('../middleware/auth');
const validate = require('../middleware/validate');
const contentValidators = require('../validators/contentValidator');

// Proteger todas las rutas de contenido
router.get('/carousel', contentController.getCarouselImages);
router.use(authenticateToken);
router.post('/carousel', contentController.upload.array('images', 10), contentController.uploadCarouselImages);
router.delete('/carousel/:filename', validate(contentValidators.deleteCarouselImage), contentController.deleteCarouselImage);

module.exports = router; 