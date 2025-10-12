const express = require('express');
const notificationController = require('../controllers/notificationController');
const { auth } = require('../middleware/auth');
const { requireAnyRole } = require('../middleware/roleAuth');

const router = express.Router();

router.get('/all', auth, requireAnyRole, notificationController.getUserNotifications);
router.put('/:notificationId/read', auth, requireAnyRole, notificationController.markAsRead);
router.get('/unread', auth, requireAnyRole, notificationController.getUnreadCount);

module.exports = router;
