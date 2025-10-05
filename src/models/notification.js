const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  // User who will receive the notification
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Type of notification
  type: {
    type: String,
    enum: [
      'appointment_booked',
      'appointment_confirmed',
      'appointment_rejected',
      'appointment_cancelled',
      'appointment_reminder_24h',
      'appointment_reminder_1h',
      'session_starting',
      'session_completed',
      'payment_success',
      'payment_failed',
      'counselor_approved',
      'counselor_rejected'
    ],
    required: true
  },

  // Title of the notification
  title: {
    type: String,
    required: true,
    maxlength: 200
  },

  // Message content
  message: {
    type: String,
    required: true,
    maxlength: 500
  },

  // Related appointment (if applicable)
  appointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },

  // Related counselor (if applicable)
  counselor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Counselor'
  },

  // Notification status
  status: {
    type: String,
    enum: ['pending', 'sent', 'failed', 'read'],
    default: 'pending'
  },

  // Delivery channels
  channels: [{
    type: String,
    enum: ['email', 'sms', 'push', 'in_app'],
    required: true
  }],

  // Delivery status for each channel
  deliveryStatus: [{
    channel: {
      type: String,
      enum: ['email', 'sms', 'push', 'in_app']
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'failed', 'delivered']
    },
    sentAt: Date,
    deliveredAt: Date,
    error: String
  }],

  // Priority level
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },

  // Scheduled send time
  scheduledFor: {
    type: Date
  },

  // Actual send time
  sentAt: {
    type: Date
  },

  // Read status
  readAt: {
    type: Date
  },

  // Additional data
  data: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes for better query performance
notificationSchema.index({ user: 1, status: 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ scheduledFor: 1 });
notificationSchema.index({ createdAt: -1 });

// Method to mark notification as read
notificationSchema.methods.markAsRead = function () {
  this.status = 'read';
  this.readAt = new Date();
  return this.save();
};

// Method to mark notification as sent
notificationSchema.methods.markAsSent = function (channel) {
  const deliveryStatus = this.deliveryStatus.find(ds => ds.channel === channel);
  if (deliveryStatus) {
    deliveryStatus.status = 'sent';
    deliveryStatus.sentAt = new Date();
  }

  // If all channels are sent, mark overall status as sent
  const allSent = this.deliveryStatus.every(ds => ds.status === 'sent');
  if (allSent) {
    this.status = 'sent';
    this.sentAt = new Date();
  }

  return this.save();
};

// Method to mark notification as failed
notificationSchema.methods.markAsFailed = function (channel, error) {
  const deliveryStatus = this.deliveryStatus.find(ds => ds.channel === channel);
  if (deliveryStatus) {
    deliveryStatus.status = 'failed';
    deliveryStatus.error = error;
  }

  // If all channels failed, mark overall status as failed
  const allFailed = this.deliveryStatus.every(ds => ds.status === 'failed');
  if (allFailed) {
    this.status = 'failed';
  }

  return this.save();
};

// Static method to get user notifications
notificationSchema.statics.getUserNotifications = function (userId, limit = 20, skip = 0) {
  return this.find({ user: userId })
    .populate('appointment', 'appointmentDate appointmentTime status')
    .populate('counselor', 'firstName lastName specialization')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

// Static method to get unread notifications count
notificationSchema.statics.getUnreadCount = function (userId) {
  return this.countDocuments({
    user: userId,
    status: { $in: ['pending', 'sent'] },
    readAt: { $exists: false }
  });
};

// Static method to get pending notifications for processing
notificationSchema.statics.getPendingNotifications = function (limit = 100) {
  return this.find({
    status: 'pending',
    $or: [
      { scheduledFor: { $exists: false } },
      { scheduledFor: { $lte: new Date() } }
    ]
  })
    .populate('user', 'email username')
    .populate('appointment')
    .populate('counselor', 'firstName lastName email phoneNumber')
    .limit(limit);
};

module.exports = mongoose.model('Notification', notificationSchema);
