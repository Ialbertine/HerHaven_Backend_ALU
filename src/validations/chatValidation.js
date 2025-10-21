const Joi = require('joi');

const chatValidation = Joi.object({
  message: Joi.string().min(1).max(2000).required().trim(),
  history: Joi.array().items(
    Joi.object({
      role: Joi.string().valid('user', 'assistant').required(),
      content: Joi.string().required().trim(),
      timestamp: Joi.string().isoDate().optional()
    })
  ).optional().default([])
});

module.exports = {
  chatValidation
};
