const mongoose = require('mongoose');

const assessmentTemplateSchema = new mongoose.Schema({
  // Template identification
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },

  category: {
    type: String,
    required: true,
    enum: ['depression', 'anxiety', 'ptsd', 'safety', 'wellness', 'general'],
    index: true
  },

  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },

  // Versioning for template updates
  version: {
    type: String,
    default: '1.0'
  },

  // Questions array
  questions: [{
    questionId: {
      type: String,
      required: true
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },
    type: {
      type: String,
      enum: ['single-choice', 'multiple-choice', 'scale', 'text'],
      required: true
    },
    options: [{
      value: {
        type: Number,
        required: true
      },
      label: {
        type: String,
        required: true,
        trim: true
      }
    }],
    // Crisis detection flags
    isCrisisIndicator: {
      type: Boolean,
      default: false
    },
    crisisThreshold: {
      type: Number
    },
    // Required or optional question
    isRequired: {
      type: Boolean,
      default: true
    },
    // Order of display
    order: {
      type: Number,
      required: true
    }
  }],

  // Scoring configuration
  scoringRules: {
    maxScore: {
      type: Number,
      required: true
    },
    severityLevels: [{
      name: {
        type: String,
        required: true
      },
      range: {
        min: {
          type: Number,
          required: true
        },
        max: {
          type: Number,
          required: true
        }
      },
      color: {
        type: String,
        default: 'green'
      },
      recommendations: [{
        type: String,
        trim: true
      }]
    }]
  },

  // Template status
  isActive: {
    type: Boolean,
    default: true
  },

  isPublished: {
    type: Boolean,
    default: false
  },

  // Estimated time to complete (in minutes)
  estimatedDuration: {
    type: Number,
    default: 5,
    min: 1,
    max: 60
  },

  // Language support
  language: {
    type: String,
    default: 'en'
  },

  // Created by admin
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },

  // Metadata
  totalResponses: {
    type: Number,
    default: 0
  },

  lastUsed: {
    type: Date
  }

}, {
  timestamps: true
});

// Indexes for better performance
assessmentTemplateSchema.index({ category: 1, isActive: 1, isPublished: 1 });
assessmentTemplateSchema.index({ name: 1 });
assessmentTemplateSchema.index({ createdAt: -1 });

// Virtual to get question count
assessmentTemplateSchema.virtual('questionCount').get(function () {
  return this.questions.length;
});

// Method to check if assessment has crisis indicators
assessmentTemplateSchema.methods.hasCrisisIndicators = function () {
  return this.questions.some(q => q.isCrisisIndicator);
};

// Method to get severity level by score
assessmentTemplateSchema.methods.getSeverityLevel = function (score) {
  if (!this.scoringRules || !this.scoringRules.severityLevels) {
    return null;
  }

  const level = this.scoringRules.severityLevels.find(
    level => score >= level.range.min && score <= level.range.max
  );

  return level || null;
};

// Pre-save validation
assessmentTemplateSchema.pre('save', function (next) {
  // Validate that questions have unique IDs
  const questionIds = this.questions.map(q => q.questionId);
  const uniqueIds = new Set(questionIds);

  if (questionIds.length !== uniqueIds.size) {
    return next(new Error('Question IDs must be unique within a template'));
  }

  // Validate severity levels cover the entire score range
  if (this.scoringRules && this.scoringRules.severityLevels.length > 0) {
    const levels = this.scoringRules.severityLevels;
    const minScore = Math.min(...levels.map(l => l.range.min));
    const maxScore = Math.max(...levels.map(l => l.range.max));

    if (minScore !== 0 || maxScore !== this.scoringRules.maxScore) {
      return next(new Error('Severity levels must cover the entire score range (0 to maxScore)'));
    }
  }

  next();
});

module.exports = mongoose.model('AssessmentTemplate', assessmentTemplateSchema);

