const Joi = require('joi');

const createFeedbackValidation = Joi.object({
  fullName: Joi.string().min(2).max(100).required().trim(),
  email: Joi.string().email().max(100).optional().trim().allow(''),
  message: Joi.string().min(10).max(1000).required().trim(),
  rating: Joi.number().min(1).max(5).optional()
});

module.exports = {
  createFeedbackValidation,
};