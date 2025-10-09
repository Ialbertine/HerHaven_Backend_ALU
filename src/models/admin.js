const mongoose = require('mongoose');
const argon2 = require('argon2');

const adminSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
    match: /^[a-zA-Z0-9_]+$/
  },

  // Admin information
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  phoneNumber: {
    type: String,
    required: true,
    trim: true
  },

  // Admin role and permissions
  role: {
    type: String,
    enum: ['super_admin', 'admin'],
    default: 'admin'
  },
  permissions: [{
    type: String,
    enum: [
      'approve_counselors',
      'manage_users',
      'view_analytics',
      'manage_content',
      'system_settings',
      'manage_appointments',
      'read', 'write', 'delete', 'create', 'update'
    ]
  }],

  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  isSuperAdmin: {
    type: Boolean,
    default: false
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

  // Admin metrics
  counselorsApproved: {
    type: Number,
    default: 0
  },
  counselorsRejected: {
    type: Number,
    default: 0
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
adminSchema.index({ isActive: 1 });
adminSchema.index({ role: 1 });
adminSchema.index({ isSuperAdmin: 1 });

// Hash password before saving
adminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    this.password = await argon2.hash(this.password);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to check password
adminSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await argon2.verify(this.password, candidatePassword);
  } catch {
    throw new Error('Password comparison failed');
  }
};

// Check if account is locked
adminSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Method to get full name
adminSchema.methods.getFullName = function () {
  return `${this.firstName} ${this.lastName}`;
};

// Method to check if admin has specific permission
adminSchema.methods.hasPermission = function (permission) {
  return this.permissions.includes(permission) || this.isSuperAdmin;
};

// Method to check if admin can approve counselors
adminSchema.methods.canApproveCounselors = function () {
  return this.hasPermission('approve_counselors') && this.isActive;
};

module.exports = mongoose.model('Admin', adminSchema);
