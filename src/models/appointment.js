const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  // User who booked the appointment
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Counselor providing the service
  counselor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Counselor',
    required: true
  },

  // User contact information at time of booking
  firstName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },

  lastName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },

  phoneNumber: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function (v) {
        return /^[\d\s\-+()]+$/.test(v);
      },
      message: 'Please provide a valid phone number'
    }
  },

  // Appointment details
  appointmentDate: {
    type: Date,
    required: true
  },

  appointmentTime: {
    type: String,
    required: true,
    validate: {
      validator: function (v) {
        // Validate time format (HH:MM)
        return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
      },
      message: 'Time must be in HH:MM format'
    }
  },

  duration: {
    type: Number,
    required: true,
    default: 60,
    min: 30,
    max: 180
  },

  // Appointment type and mode
  appointmentType: {
    type: String,
    enum: ['individual', 'group', 'couple'],
    default: 'individual'
  },

  sessionMode: {
    type: String,
    enum: ['video', 'audio', 'chat', 'in-person'],
    default: 'video'
  },

  // Status tracking
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled', 'no-show'],
    default: 'pending'
  },

  reason: {
    type: String,
    maxlength: 500,
    trim: true
  },

  // Emergency level
  urgencyLevel: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },

  // Session details
  sessionNotes: {
    type: String,
    maxlength: 1000,
    trim: true
  },

  // Feedback and rating
  userRating: {
    type: Number,
    min: 1,
    max: 5
  },

  userFeedback: {
    type: String,
    maxlength: 500,
    trim: true
  },

  // Cancellation details
  cancelledBy: {
    type: String,
    enum: ['user', 'counselor', 'admin', 'system']
  },

  cancellationReason: {
    type: String,
    maxlength: 200,
    trim: true
  },

  cancelledAt: {
    type: Date
  },

  // Rescheduling
  isRescheduled: {
    type: Boolean,
    default: false
  },

  originalAppointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },

  // Meeting details 
  meetingDetails: {
    meetingId: {
      type: String,
      trim: true
    },
    meetingUrl: {
      type: String,
      trim: true
    },
    hostUrl: {
      type: String,
      trim: true
    },
    password: {
      type: String,
      trim: true
    },
    startTime: {
      type: Date
    },
    endTime: {
      type: Date
    },
    recordingUrl: {
      type: String,
      trim: true
    }
  },

  // Reminders
  remindersSent: [{
    type: {
      type: String,
      enum: ['in-app', 'push']
    },
    sentAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Privacy and safety
  isAnonymous: {
    type: Boolean,
    default: false
  },

  // Timestamps
  confirmedAt: {
    type: Date
  },

  startedAt: {
    type: Date
  },

  endedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for better query performance
appointmentSchema.index({ user: 1, status: 1 });
appointmentSchema.index({ counselor: 1, status: 1 });
appointmentSchema.index({ appointmentDate: 1, appointmentTime: 1 });
appointmentSchema.index({ status: 1 });
appointmentSchema.index({ urgencyLevel: 1 });

// Virtual for appointment datetime
appointmentSchema.virtual('appointmentDateTime').get(function () {
  const date = new Date(this.appointmentDate);
  const [hours, minutes] = this.appointmentTime.split(':');
  date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  return date;
});

// Method to check if appointment is in the past
appointmentSchema.methods.isPast = function () {
  return this.appointmentDateTime < new Date();
};

// Method to check if appointment is today
appointmentSchema.methods.isToday = function () {
  const today = new Date();
  const appointmentDate = new Date(this.appointmentDate);
  return appointmentDate.toDateString() === today.toDateString();
};

// Method to check if appointment is upcoming (within next 24 hours)
appointmentSchema.methods.isUpcoming = function () {
  const now = new Date();
  const appointmentTime = this.appointmentDateTime;
  const timeDiff = appointmentTime.getTime() - now.getTime();
  return timeDiff > 0 && timeDiff <= 24 * 60 * 60 * 1000;
};

// Method to get appointment duration in minutes
appointmentSchema.methods.getDurationInMinutes = function () {
  return this.duration;
};

// Method to check if appointment can be cancelled
appointmentSchema.methods.canBeCancelled = function () {
  const now = new Date();
  const appointmentTime = this.appointmentDateTime;
  const timeDiff = appointmentTime.getTime() - now.getTime();
  const hoursUntilAppointment = timeDiff / (1000 * 60 * 60);

  return this.status === 'confirmed' && hoursUntilAppointment > 2;
};

// Method to check if appointment can be rescheduled
appointmentSchema.methods.canBeRescheduled = function () {
  const now = new Date();
  const appointmentTime = this.appointmentDateTime;
  const timeDiff = appointmentTime.getTime() - now.getTime();
  const hoursUntilAppointment = timeDiff / (1000 * 60 * 60);

  return this.status === 'confirmed' && hoursUntilAppointment > 24;
};

// Pre-save middleware to validate appointment date
appointmentSchema.pre('save', function (next) {
  if (this.appointmentDate && this.appointmentTime) {
    const appointmentDateTime = this.appointmentDateTime;
    const now = new Date();

    // Don't allow appointments in the past (except for rescheduling)
    if (appointmentDateTime < now && !this.isRescheduled) {
      return next(new Error('Cannot book appointments in the past'));
    }

    // Don't allow appointments more than 3 months in advance
    const threeMonthsFromNow = new Date();
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);

    if (appointmentDateTime > threeMonthsFromNow) {
      return next(new Error('Cannot book appointments more than 3 months in advance'));
    }
  }

  next();
});

module.exports = mongoose.model('Appointment', appointmentSchema);
