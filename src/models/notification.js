const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

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

  title: {
    type: String,
    required: true,
    maxlength: 200
  },

  message: {
    type: String,
    required: true,
    maxlength: 500
  },

  appointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },

  counselor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Counselor'
  },

  status: {
    type: String,
    enum: ['pending', 'sent', 'failed', 'read'],
    default: 'pending'
  },

  channels: [{
    type: String,
    enum: ['email', 'in_app'],
    required: true
  }],

  deliveryStatus: [{
    channel: {
      type: String,
      enum: ['email', 'in_app']
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'failed', 'delivered']
    },
    sentAt: Date,
    deliveredAt: Date,
    error: String
  }],

  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },

  scheduledFor: Date,
  sentAt: Date,
  readAt: Date,
  data: mongoose.Schema.Types.Mixed
}, {
  timestamps: true
});

notificationSchema.index({ user: 1, status: 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ scheduledFor: 1 });
notificationSchema.index({ createdAt: -1 });

notificationSchema.methods.markAsRead = function () {
  this.status = 'read';
  this.readAt = new Date();
  return this.save();
};

notificationSchema.methods.markAsSent = function (channel) {
  const deliveryStatus = this.deliveryStatus.find(ds => ds.channel === channel);
  if (deliveryStatus) {
    deliveryStatus.status = 'sent';
    deliveryStatus.sentAt = new Date();
  }

  const allSent = this.deliveryStatus.every(ds => ds.status === 'sent');
  if (allSent) {
    this.status = 'sent';
    this.sentAt = new Date();
  }

  return this.save();
};

notificationSchema.methods.markAsFailed = function (channel, error) {
  const deliveryStatus = this.deliveryStatus.find(ds => ds.channel === channel);
  if (deliveryStatus) {
    deliveryStatus.status = 'failed';
    deliveryStatus.error = error;
  }

  const allFailed = this.deliveryStatus.every(ds => ds.status === 'failed');
  if (allFailed) {
    this.status = 'failed';
  }

  return this.save();
};

notificationSchema.statics.getUserNotifications = function (userId, limit = 20, skip = 0) {
  return this.find({ user: userId })
    .populate('appointment', 'appointmentDate appointmentTime status')
    .populate('counselor', 'firstName lastName specialization')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

notificationSchema.statics.getUnreadCount = function (userId) {
  return this.countDocuments({
    user: userId,
    status: { $in: ['pending', 'sent'] },
    readAt: { $exists: false }
  });
};

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
