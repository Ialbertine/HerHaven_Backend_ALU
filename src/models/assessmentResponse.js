const mongoose = require('mongoose');

const assessmentResponseSchema = new mongoose.Schema({
  // User reference (optional for anonymous assessments)
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },

  // Session ID for anonymous users
  sessionId: {
    type: String,
    trim: true
  },

  // Template reference
  template: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AssessmentTemplate',
    required: true
  },

  // Template for historical tracking if template changes
  templateSnapshot: {
    name: String,
    version: String,
    category: String
  },

  // User responses
  responses: [{
    questionId: {
      type: String,
      required: true
    },
    answer: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    score: {
      type: Number,
      default: 0
    }
  }],

  // Assessment results
  totalScore: {
    type: Number,
    required: true,
    default: 0
  },

  severityLevel: {
    type: String,
    trim: true
  },

  // Crisis flag
  isCrisis: {
    type: Boolean,
    default: false
  },

  crisisIndicators: [{
    questionId: String,
    questionText: String,
    answer: mongoose.Schema.Types.Mixed
  }],

  // Status tracking
  status: {
    type: String,
    enum: ['in-progress', 'completed', 'abandoned'],
    default: 'in-progress'
  },

  completedAt: {
    type: Date
  },

  // Duration tracking
  startedAt: {
    type: Date,
    default: Date.now
  },

  durationInSeconds: {
    type: Number
  },

  // Sharing and privacy
  isAnonymous: {
    type: Boolean,
    default: false
  },

  shareWithCounselor: {
    type: Boolean,
    default: false
  },

  sharedWith: [{
    counselor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Counselor'
    },
    sharedAt: {
      type: Date,
      default: Date.now
    },
    viewedAt: {
      type: Date
    }
  }],

  // User notes
  userNotes: {
    type: String,
    maxlength: 1000,
    trim: true
  },

  // Counselor notes (if shared)
  counselorNotes: {
    type: String,
    maxlength: 1000,
    trim: true
  },

  // Recommendations generated
  recommendations: [{
    type: {
      type: String,
      enum: ['resource', 'action', 'appointment']
    },
    title: String,
    description: String,
    link: String,
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    }
  }],

  // Follow-up actions
  followUpActions: [{
    action: {
      type: String,
      enum: ['counselor_notified', 'appointment_suggested']
    },
    performedAt: {
      type: Date,
      default: Date.now
    },
    details: mongoose.Schema.Types.Mixed
  }],

  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false
  },

  deletedAt: {
    type: Date
  },

  // Data retention for anonymous assessments
  expiresAt: {
    type: Date
  }

}, {
  timestamps: true
});

// Indexes for performance
assessmentResponseSchema.index({ user: 1, createdAt: -1 });
assessmentResponseSchema.index({ template: 1 });
assessmentResponseSchema.index({ sessionId: 1 });
assessmentResponseSchema.index({ status: 1 });
assessmentResponseSchema.index({ isCrisis: 1 });
assessmentResponseSchema.index({ completedAt: -1 });
assessmentResponseSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound indexes
assessmentResponseSchema.index({ user: 1, template: 1, completedAt: -1 });
assessmentResponseSchema.index({ 'sharedWith.counselor': 1, shareWithCounselor: 1 });

// Virtual to check if assessment is expired
assessmentResponseSchema.virtual('isExpired').get(function () {
  return this.expiresAt && this.expiresAt < new Date();
});

// Virtual to get completion percentage
assessmentResponseSchema.virtual('completionPercentage').get(function () {
  if (!this.template || !this.template.questions) return 0;
  const totalQuestions = this.template.questions.length;
  const answeredQuestions = this.responses.length;
  return Math.round((answeredQuestions / totalQuestions) * 100);
});

// Method to check if user owns this assessment
assessmentResponseSchema.methods.isOwnedBy = function (userId) {
  return this.user && this.user.toString() === userId.toString();
};

// Method to check if counselor has access
assessmentResponseSchema.methods.canBeAccessedBy = function (counselorId) {
  if (!this.shareWithCounselor) return false;
  return this.sharedWith.some(
    share => share.counselor.toString() === counselorId.toString()
  );
};

// Method to mark as viewed by counselor
assessmentResponseSchema.methods.markViewedBy = async function (counselorId) {
  const share = this.sharedWith.find(
    s => s.counselor.toString() === counselorId.toString()
  );
  if (share && !share.viewedAt) {
    share.viewedAt = new Date();
    await this.save();
  }
};

// Pre-save middleware
assessmentResponseSchema.pre('save', function (next) {
  // Set expiry for anonymous assessments (30 days)
  if (this.isAnonymous && !this.expiresAt && this.completedAt) {
    const expiryDate = new Date(this.completedAt);
    expiryDate.setDate(expiryDate.getDate() + 30);
    this.expiresAt = expiryDate;
  }

  // Calculate duration when completed
  if (this.status === 'completed' && this.completedAt && !this.durationInSeconds) {
    const durationMs = this.completedAt.getTime() - this.startedAt.getTime();
    this.durationInSeconds = Math.round(durationMs / 1000);
  }

  next();
});

module.exports = mongoose.model('AssessmentResponse', assessmentResponseSchema);

