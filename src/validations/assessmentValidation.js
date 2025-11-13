const Joi = require('joi');

// Create assessment template validation (admin only)
const createTemplateValidation = Joi.object({
  name: Joi.string().trim().max(100).required().messages({
    'string.empty': 'Template name is required',
    'any.required': 'Template name is required'
  }),
  category: Joi.string().valid('depression', 'anxiety', 'ptsd', 'safety', 'wellness', 'general').required().messages({
    'any.only': 'Invalid category',
    'any.required': 'Category is required'
  }),
  description: Joi.string().trim().max(500).required().messages({
    'string.empty': 'Description is required',
    'any.required': 'Description is required'
  }),
  version: Joi.string().trim().default('1.0'),
  questions: Joi.array().min(1).items(
    Joi.object({
      questionId: Joi.string().required(),
      text: Joi.string().trim().max(500).required(),
      type: Joi.string().valid('single-choice', 'multiple-choice', 'scale', 'text').required(),
      options: Joi.array().items(
        Joi.object({
          value: Joi.number().required(),
          label: Joi.string().trim().required()
        })
      ).optional(),
      isCrisisIndicator: Joi.boolean().default(false),
      crisisThreshold: Joi.number().optional(),
      isRequired: Joi.boolean().default(true),
      order: Joi.number().required()
    })
  ).required().messages({
    'array.min': 'At least one question is required'
  }),
  scoringRules: Joi.object({
    maxScore: Joi.number().min(0).required(),
    severityLevels: Joi.array().min(1).items(
      Joi.object({
        name: Joi.string().required(),
        range: Joi.object({
          min: Joi.number().required(),
          max: Joi.number().required()
        }).required(),
        color: Joi.string().optional(),
        recommendations: Joi.array().items(Joi.string()).optional()
      })
    ).required()
  }).required(),
  estimatedDuration: Joi.number().min(1).max(60).default(5),
  language: Joi.string().default('en'),
  isActive: Joi.boolean().default(true),
  isPublished: Joi.boolean().default(false)
});

// Update template validation
const updateTemplateValidation = Joi.object({
  name: Joi.string().trim().max(100).optional(),
  description: Joi.string().trim().max(500).optional(),
  version: Joi.string().trim().optional(),
  questions: Joi.array().min(1).items(
    Joi.object({
      questionId: Joi.string().required(),
      text: Joi.string().trim().max(500).required(),
      type: Joi.string().valid('single-choice', 'multiple-choice', 'scale', 'text').required(),
      options: Joi.array().items(
        Joi.object({
          value: Joi.number().required(),
          label: Joi.string().trim().required()
        })
      ).optional(),
      isCrisisIndicator: Joi.boolean().default(false),
      crisisThreshold: Joi.number().optional(),
      isRequired: Joi.boolean().default(true),
      order: Joi.number().required()
    })
  ).optional(),
  scoringRules: Joi.object({
    maxScore: Joi.number().min(0).required(),
    severityLevels: Joi.array().min(1).items(
      Joi.object({
        name: Joi.string().required(),
        range: Joi.object({
          min: Joi.number().required(),
          max: Joi.number().required()
        }).required(),
        color: Joi.string().optional(),
        recommendations: Joi.array().items(Joi.string()).optional()
      })
    ).required()
  }).optional(),
  estimatedDuration: Joi.number().min(1).max(60).optional(),
  isActive: Joi.boolean().optional(),
  isPublished: Joi.boolean().optional()
});

// Submit assessment response validation
const submitAssessmentValidation = Joi.object({
  templateId: Joi.string().required().messages({
    'string.empty': 'Template ID is required',
    'any.required': 'Template ID is required'
  }),
  responses: Joi.array().min(1).items(
    Joi.object({
      questionId: Joi.string().required(),
      answer: Joi.alternatives().try(
        Joi.string(),
        Joi.number(),
        Joi.array().items(Joi.alternatives().try(Joi.string(), Joi.number()))
      ).required()
    })
  ).required().messages({
    'array.min': 'At least one response is required',
    'any.required': 'Responses are required'
  }),
  isAnonymous: Joi.boolean().default(false),
  shareWithCounselor: Joi.boolean().default(false),
  counselorId: Joi.string().optional(),
  userNotes: Joi.string().trim().max(1000).optional().allow('')
});

// Save progress validation (for in-progress assessments)
const saveProgressValidation = Joi.object({
  templateId: Joi.string().required(),
  responses: Joi.array().items(
    Joi.object({
      questionId: Joi.string().required(),
      answer: Joi.alternatives().try(
        Joi.string(),
        Joi.number(),
        Joi.array().items(Joi.alternatives().try(Joi.string(), Joi.number()))
      ).required()
    })
  ).required()
});

// Share assessment validation
const shareAssessmentValidation = Joi.object({
  counselorId: Joi.string().required().messages({
    'string.empty': 'Counselor ID is required',
    'any.required': 'Counselor ID is required'
  })
});

// Add notes validation (counselor)
const addCounselorNotesValidation = Joi.object({
  notes: Joi.string().trim().max(1000).required().messages({
    'string.empty': 'Notes cannot be empty',
    'any.required': 'Notes are required'
  })
});

// Update user notes validation
const updateUserNotesValidation = Joi.object({
  notes: Joi.string().trim().max(1000).required().allow('')
});

// Query validation for filtering assessments
const assessmentQueryValidation = Joi.object({
  category: Joi.string().valid('depression', 'anxiety', 'ptsd', 'safety', 'wellness', 'general').optional(),
  status: Joi.string().valid('in-progress', 'completed', 'abandoned').optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  limit: Joi.number().min(1).max(100).default(20),
  page: Joi.number().min(1).default(1)
});

module.exports = {
  createTemplateValidation,
  updateTemplateValidation,
  submitAssessmentValidation,
  saveProgressValidation,
  shareAssessmentValidation,
  addCounselorNotesValidation,
  updateUserNotesValidation,
  assessmentQueryValidation
};

