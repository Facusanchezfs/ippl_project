const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { 
  getActivities, 
  markAsRead, 
  markAllAsRead, 
  getUnreadCount,
  clearAllActivities,
  createActivity
} = require('../controllers/activityController');

router.use(authenticateToken);

router.post('/', createActivity);

router.get('/', getActivities);

router.get('/unread-count', getUnreadCount);

router.put('/:id/read', markAsRead);

router.put('/read-all', markAllAsRead);

router.delete('/clear-all', clearAllActivities);

module.exports = router; 