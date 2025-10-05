const Notification = require('../models/notification');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');

const notificationController = {
  // Get user notifications
  getUserNotifications: async (req, res) => {
    try {
      const userId = req.user._id;
      const { limit = 20, skip = 0, unreadOnly = false } = req.query;

      const filter = { user: userId };
      if (unreadOnly === 'true') {
        filter.status = { $in: ['pending', 'sent'] };
        filter.readAt = { $exists: false };
      }

      const notifications = await Notification.find(filter)
        .populate('appointment', 'appointmentDate appointmentTime status')
        .populate('counselor', 'firstName lastName specialization')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      const unreadCount = await Notification.getUnreadCount(userId);

      res.json({
        success: true,
        message: 'Notifications retrieved',
        data: {
          notifications,
          unreadCount,
          total: notifications.length
        }
      });

    } catch (error) {
      logger.error('Get user notifications error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve notifications'
      });
    }
  },

  // Mark notification as read
  markAsRead: async (req, res) => {
    try {
      const { notificationId } = req.params;
      const userId = req.user._id;

      const notification = await Notification.findOne({
        _id: notificationId,
        user: userId
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      await notification.markAsRead();

      res.json({
        success: true,
        message: 'Notification marked as read',
        data: {
          notificationId: notification._id,
          readAt: notification.readAt
        }
      });

    } catch (error) {
      logger.error('Mark notification as read error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark notification as read'
      });
    }
  },

  // Mark all notifications as read
  markAllAsRead: async (req, res) => {
    try {
      const userId = req.user._id;

      const result = await Notification.updateMany(
        {
          user: userId,
          status: { $in: ['pending', 'sent'] },
          readAt: { $exists: false }
        },
        {
          $set: {
            status: 'read',
            readAt: new Date()
          }
        }
      );

      res.json({
        success: true,
        message: 'All notifications marked as read',
        data: {
          modifiedCount: result.modifiedCount
        }
      });

    } catch (error) {
      logger.error('Mark all notifications as read error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark all notifications as read'
      });
    }
  },

  // Get unread notifications count
  getUnreadCount: async (req, res) => {
    try {
      const userId = req.user._id;

      const unreadCount = await Notification.getUnreadCount(userId);

      res.json({
        success: true,
        message: 'Unread count retrieved',
        data: {
          unreadCount
        }
      });

    } catch (error) {
      logger.error('Get unread count error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get unread count'
      });
    }
  },

  // Create notification (internal use)
  createNotification: async (userId, type, title, message, options = {}) => {
    try {
      const notification = new Notification({
        user: userId,
        type,
        title,
        message,
        appointment: options.appointment,
        counselor: options.counselor,
        channels: options.channels || ['in-app'],
        priority: options.priority || 'medium',
        scheduledFor: options.scheduledFor,
        data: options.data
      });

      // Initialize delivery status for each channel
      notification.deliveryStatus = notification.channels.map(channel => ({
        channel,
        status: 'pending'
      }));

      await notification.save();
      return notification;
    } catch (error) {
      logger.error('Create notification error:', error);
      throw error;
    }
  },

  // Process pending notifications (for background job)
  processPendingNotifications: async () => {
    try {
      const pendingNotifications = await Notification.getPendingNotifications(50);

      for (const notification of pendingNotifications) {
        try {
          await processNotification(notification);
        } catch (error) {
          logger.error(`Failed to process notification ${notification._id}:`, error);
          await notification.markAsFailed('email', error.message);
        }
      }

      logger.info(`Processed ${pendingNotifications.length} pending notifications`);
    } catch (error) {
      logger.error('Process pending notifications error:', error);
    }
  }
};

// Helper function to process individual notification
async function processNotification(notification) {
  const { user, appointment, counselor, type, data } = notification;

  switch (type) {
    case 'appointment_booked':
      if (appointment && counselor) {
        await notificationService.notifyAppointmentBooked(appointment, user, counselor);
        await notification.markAsSent('in-app');
      }
      break;

    case 'appointment_confirmed':
      if (appointment && counselor) {
        await notificationService.notifyAppointmentConfirmed(appointment, user, counselor);
        await notification.markAsSent('in-app');
      }
      break;

    case 'appointment_cancelled':
      if (appointment && counselor) {
        await notificationService.notifyAppointmentCancelled(
          appointment,
          user,
          counselor,
          data?.cancelledBy,
          data?.reason
        );
        await notification.markAsSent('in-app');
      }
      break;

    case 'appointment_reminder_24h':
    case 'appointment_reminder_1h':
      if (appointment && counselor) {
        const reminderType = type === 'appointment_reminder_24h' ? '24h' : '1h';
        await notificationService.notifyAppointmentReminder(appointment, user, counselor, reminderType);
        await notification.markAsSent('in-app');
      }
      break;

    case 'session_starting':
      if (appointment && counselor) {
        await notificationService.notifySessionStarting(appointment, user, counselor, data?.meetingLink);
        await notification.markAsSent('in-app');
      }
      break;

    case 'session_completed':
      if (appointment && counselor) {
        await notificationService.notifySessionCompleted(appointment, user, counselor);
        await notification.markAsSent('in-app');
      }
      break;

    default:
      logger.warn(`Unknown notification type: ${type}`);
      await notification.markAsFailed('in-app', 'Unknown notification type');
  }
}

module.exports = notificationController;
