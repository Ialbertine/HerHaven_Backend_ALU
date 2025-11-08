const Joi = require('joi');

const createContactMessageValidation = Joi.object({
  firstName: Joi.string().trim().min(2).max(60).required(),
  lastName: Joi.string().trim().min(2).max(60).required(),
  email: Joi.string().trim().email().max(120).required(),
  phoneNumber: Joi.string()
    .trim()
    .pattern(/^[0-9()+\-\s]{7,20}$/)
    .required()
    .messages({
      'string.pattern.base': 'Phone number must contain only digits and common phone characters.',
    }),
  message: Joi.string().trim().min(10).max(500).required(),
});

module.exports = {
  createContactMessageValidation,
};

