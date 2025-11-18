const Joi = require('joi');
const mongoose = require('mongoose');

// Validation schemas
const createPostSchema = Joi.object({
  title: Joi.string()
    .trim()
    .min(3)
    .max(200)
    .optional()
    .messages({
      'string.min': 'Title must be at least 3 characters long',
      'string.max': 'Title cannot exceed 200 characters'
    }),
  content: Joi.string()
    .trim()
    .min(10)
    .max(5000)
    .required()
    .messages({
      'string.empty': 'Content is required',
      'string.min': 'Content must be at least 10 characters long',
      'string.max': 'Content cannot exceed 5000 characters'
    }),
  tags: Joi.array()
    .items(Joi.string().trim().max(50))
    .max(10)
    .optional(),
  isAnonymous: Joi.boolean().optional()
});

const updatePostSchema = Joi.object({
  title: Joi.string()
    .trim()
    .min(3)
    .max(200)
    .optional(),
  content: Joi.string()
    .trim()
    .min(10)
    .max(5000)
    .optional(),
  tags: Joi.array()
    .items(Joi.string().trim().max(50))
    .max(10)
    .optional(),
  isAnonymous: Joi.boolean().optional()
}).min(1);

const createCommentSchema = Joi.object({
  content: Joi.string()
    .trim()
    .min(1)
    .max(2000)
    .required()
    .messages({
      'string.empty': 'Comment content is required',
      'string.max': 'Comment cannot exceed 2000 characters'
    }),
  parentComment: Joi.string()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .optional()
    .messages({
      'any.invalid': 'Invalid parent comment ID'
    }),
  isAnonymous: Joi.boolean().optional()
});

const updateCommentSchema = Joi.object({
  content: Joi.string()
    .trim()
    .min(1)
    .max(2000)
    .optional(),
  isAnonymous: Joi.boolean().optional()
}).min(1);

// Validation middleware
const validateCreatePost = (req, res, next) => {
  const { error, value } = createPostSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errors = error.details.map(detail => detail.message);
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors
    });
  }

  req.body = value;
  next();
};

const validateUpdatePost = (req, res, next) => {
  const { error, value } = updatePostSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errors = error.details.map(detail => detail.message);
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors
    });
  }

  req.body = value;
  next();
};

const validateCreateComment = (req, res, next) => {
  const { error, value } = createCommentSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errors = error.details.map(detail => detail.message);
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors
    });
  }

  req.body = value;
  next();
};

const validateUpdateComment = (req, res, next) => {
  const { error, value } = updateCommentSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errors = error.details.map(detail => detail.message);
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors
    });
  }

  req.body = value;
  next();
};

// Helper function to validate ObjectId
const validateObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};


const sanitizeHtml = (text) => {
  if (!text) return '';

  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
};

module.exports = {
  validateCreatePost,
  validateUpdatePost,
  validateCreateComment,
  validateUpdateComment,
  validateObjectId,
  sanitizeHtml
};