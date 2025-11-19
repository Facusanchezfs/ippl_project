const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

const dataDir = path.join(__dirname, '../data');
const messagesFilePath = path.join(dataDir, 'messages.json');

// Función para inicializar el archivo de mensajes
async function initializeMessagesFile() {
  try {
    // Crear el directorio data si no existe
    await fs.mkdir(dataDir, { recursive: true });
    
    // Verificar si el archivo existe
    try {
      await fs.access(messagesFilePath);
    } catch {
      // Si el archivo no existe, crearlo con un array vacío
      await fs.writeFile(
        messagesFilePath,
        JSON.stringify({ messages: [] }, null, 2),
        'utf8'
      );
    }
  } catch (error) {
    logger.error('Error initializing messages file:', error);
  }
}

// Inicializar el archivo al cargar el servicio
initializeMessagesFile();

const messageService = {
  async getAllMessages() {
    try {
      await initializeMessagesFile(); // Asegurarse de que el archivo existe
      const data = await fs.readFile(messagesFilePath, 'utf8');
      const { messages } = JSON.parse(data);
      // Sort messages by date in descending order (newest first)
      return messages.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    } catch (error) {
      logger.error('Error reading messages:', error);
      return [];
    }
  },

  async saveMessage(message) {
    try {
      await initializeMessagesFile(); // Asegurarse de que el archivo existe
      let messages = [];
      try {
        const data = await fs.readFile(messagesFilePath, 'utf8');
        messages = JSON.parse(data).messages;
      } catch {
        messages = [];
      }
      
      const newMessage = {
        _id: Date.now().toString(),
        ...message,
        fecha: new Date().toISOString(),
        leido: false
      };
      
      messages.push(newMessage);
      
      await fs.writeFile(
        messagesFilePath,
        JSON.stringify({ messages }, null, 2),
        'utf8'
      );
      
      return newMessage;
    } catch (error) {
      logger.error('Error saving message:', error);
      return null;
    }
  },

  async markAsRead(messageId) {
    try {
      await initializeMessagesFile(); // Asegurarse de que el archivo existe
      const data = await fs.readFile(messagesFilePath, 'utf8');
      const { messages } = JSON.parse(data);
      
      const updatedMessages = messages.map(msg => 
        msg._id === messageId ? { ...msg, leido: true } : msg
      );
      
      await fs.writeFile(
        messagesFilePath,
        JSON.stringify({ messages: updatedMessages }, null, 2),
        'utf8'
      );
      
      return true;
    } catch (error) {
      logger.error('Error marking message as read:', error);
      return false;
    }
  }
};

module.exports = messageService; 