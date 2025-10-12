const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  // User is optional for anonymous feedback
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  fullName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  email: {
    type: String,
    required: false,
    trim: true,
    lowercase: true,
    maxlength: 100
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    required: false
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'published', 'archived'],
    default: 'pending'
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  isAnonymous: {
    type: Boolean,
    default: false
  },
  adminNotes: {
    type: String,
    maxlength: 500,
    trim: true
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  reviewedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes
feedbackSchema.index({ user: 1 });
feedbackSchema.index({ status: 1 });
feedbackSchema.index({ isPublic: 1 });
feedbackSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Feedback', feedbackSchema);