const mongoose = require('mongoose');
const argon2 = require('argon2');

const counselorSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    minlength: 6
  },
  username: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
    match: /^[a-zA-Z0-9_]+$/
  },

  // Professional information
  firstName: {
    type: String,
    trim: true
  },
  lastName: {
    type: String,
    trim: true
  },
  phoneNumber: {
    type: String,
    trim: true
  },
  profilePicture: {
    type: String,
    trim: true,
    default: null
  },
  role: {
    type: String,
    default: 'counselor',
    immutable: true
  },
  licenseNumber: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  specialization: {
    type: String,
    enum: [
      'Trauma Counseling',
      'Domestic Violence',
      'Sexual Assault',
      'Mental Health',
      'Family Counseling',
      'Child Psychology',
      'Substance Abuse',
      'General Counseling'
    ]
  },
  experience: {
    type: Number,
    min: 0
  },
  bio: {
    type: String,
    maxlength: 500,
    trim: true
  },

  // Verification and status
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  verificationStatus: {
    type: String,
    enum: ['invited', 'pending', 'approved', 'rejected'], 
    default: 'pending'
  },

  // Invitation fields
  inviteToken: {
    type: String,
    sparse: true
  },
  inviteTokenExpiry: {
    type: Date
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  invitedAt: {
    type: Date
  },

  // Admin approval tracking
  adminApprovedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  adminApprovedAt: {
    type: Date
  },
  rejectionReason: {
    type: String,
    trim: true
  },

  // Activity tracking
  lastLogin: {
    type: Date
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },

  // Professional metrics
  totalSessions: {
    type: Number,
    default: 0
  },
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
    isAvailable: {
    type: Boolean,
    default: true
  },
  availability: [{
    day: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      required: true
    },
    slots: [{
      startTime: {
        type: String,
        required: true,
        validate: {
          validator: function(v) {
            return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
          },
          message: 'Time must be in HH:MM format'
        }
      },
      endTime: {
        type: String,
        required: true,
        validate: {
          validator: function(v) {
            return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
          },
          message: 'Time must be in HH:MM format'
        }
      }
    }]
  }]
}, {
  timestamps: true
});

// Indexes for better query performance
counselorSchema.index({ isActive: 1 });
counselorSchema.index({ isVerified: 1 });
counselorSchema.index({ verificationStatus: 1 });
counselorSchema.index({ specialization: 1 });
counselorSchema.index({ isAvailable: 1 });

// Hash password before saving
counselorSchema.pre('save', async function (next) {
  if (!this.password || !this.isModified('password')) return next();

  try {
    this.password = await argon2.hash(this.password);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to check password
counselorSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await argon2.verify(this.password, candidatePassword);
  } catch {
    throw new Error('Password comparison failed');
  }
};

// Check if account is locked
counselorSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Method to get full name
counselorSchema.methods.getFullName = function () {
  return `${this.firstName} ${this.lastName}`;
};

// Method to check if counselor is available for sessions
counselorSchema.methods.isAvailableForSession = function () {
  return this.isActive && this.isVerified && this.isAvailable && !this.isLocked();
};

module.exports = mongoose.model('Counselor', counselorSchema);
