const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');

function createDirectories() {
  const directories = [
    path.join(__dirname, '..', 'uploads'),
    path.join(__dirname, '..', 'uploads', 'audios'),
    path.join(__dirname, 'data')
  ];

  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`✅ Directorio creado: ${dir}`);
    } else {
      logger.info(`👍 Directorio ya existe: ${dir}`);
    }
  });
}

try {
  createDirectories();
  logger.info('🚀 Setup completado exitosamente!');
} catch (error) {
  logger.error('❌ Error durante el setup:', error);
  process.exit(1);
} 