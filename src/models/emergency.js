const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const emergencyContactSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Contact name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  relationship: {
    type: String,
    required: [true, 'Relationship is required'],
    enum: ['family', 'friend', 'partner', 'colleague', 'other'],
    default: 'other'
  },
  phoneNumber: {
    type: String,
    required: false,
    trim: true,
    validate: {
      validator: function (v) {
        if (!v) return true;
        return /^\+[1-9]\d{1,14}$/.test(v);
      },
      message: 'Phone number must be in international format (e.g., +250788123456)'
    }
  },
  email: {
    type: String,
    required: [true, 'Email is required for emergency alerts'],
    trim: true,
    lowercase: true,
    validate: {
      validator: function (v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Invalid email format'
    }
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  consentGiven: {
    type: Boolean,
    default: false,
    required: true
  },
  consentGivenAt: {
    type: Date
  },
  priority: {
    type: Number,
    default: 0,
    min: 0,
    max: 10
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  lastContactedAt: {
    type: Date
  },
  verificationStatus: {
    type: String,
    enum: ['unverified', 'pending', 'verified', 'failed'],
    default: 'unverified'
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

emergencyContactSchema.index({ userId: 1, isActive: 1, consentGiven: 1 });
emergencyContactSchema.index({ userId: 1, priority: -1 });
emergencyContactSchema.index({ userId: 1, email: 1 }, { unique: true });

emergencyContactSchema.pre('save', function (next) {
  if (this.isModified('consentGiven') && this.consentGiven && !this.consentGivenAt) {
    this.consentGivenAt = new Date();
  }
  next();
});

emergencyContactSchema.statics.getActiveContacts = function (userId) {
  return this.find({
    userId,
    isActive: true,
    consentGiven: true
  }).sort({ priority: -1, createdAt: 1 });
};

emergencyContactSchema.statics.countActiveContacts = function (userId) {
  return this.countDocuments({
    userId,
    isActive: true,
    consentGiven: true
  });
};

emergencyContactSchema.methods.markContacted = function () {
  this.lastContactedAt = new Date();
  return this.save();
};

emergencyContactSchema.virtual('displayName').get(function () {
  return `${this.name} (${this.relationship})`;
});

const EmergencyContact = mongoose.model('EmergencyContact', emergencyContactSchema);

module.exports = EmergencyContact;