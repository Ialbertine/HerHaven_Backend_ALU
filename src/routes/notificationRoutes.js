const express = require('express');
const notificationController = require('../controllers/notificationController');
const { auth } = require('../middleware/auth');
const { requireAnyRole } = require('../middleware/roleAuth');

const router = express.Router();

// GET /api/notifications
router.get('/', auth, requireAnyRole, notificationController.getUserNotifications);

// PUT /api/notifications/:notificationId/read
router.put('/:notificationId/read', auth, requireAnyRole, notificationController.markAsRead);

// PUT /api/notifications/read-all
router.put('/read-all', auth, requireAnyRole, notificationController.markAllAsRead);

// GET /api/notifications/unread-count
router.get('/unread-count', auth, requireAnyRole, notificationController.getUnreadCount);

module.exports = router;
