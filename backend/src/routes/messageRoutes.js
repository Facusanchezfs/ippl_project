'use strict';
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { requireMessageManager, loadMessageById } = require('../middleware/message');
const messageController = require('../controllers/messageController');
const validate = require('../middleware/validate');
const messageValidators = require('../validators/messageValidator');

router.post('/', validate(messageValidators.create), messageController.createMessage);


router.get('/', authenticateToken, requireMessageManager, messageController.getAllMessages);
router.put('/:id/read',
  authenticateToken,
  requireMessageManager,
  validate(messageValidators.markAsRead),
  loadMessageById,
  messageController.markAsRead
);

router.delete('/clear-all',
  authenticateToken,
  requireMessageManager,
  messageController.clearAllMessages
);

module.exports = router; 