const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

const dataDir = path.join(__dirname, '../data');
const messagesFilePath = path.join(dataDir, 'messages.json');

async function initializeMessagesFile() {
  try {
    await fs.mkdir(dataDir, { recursive: true });
    
    try {
      await fs.access(messagesFilePath);
    } catch {
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

initializeMessagesFile();

const messageService = {
  async getAllMessages() {
    try {
      await initializeMessagesFile();
      const data = await fs.readFile(messagesFilePath, 'utf8');
      const { messages } = JSON.parse(data);
      return messages.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    } catch (error) {
      logger.error('Error reading messages:', error);
      return [];
    }
  },

  async saveMessage(message) {
    try {
      await initializeMessagesFile();
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
      await initializeMessagesFile();
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