const Joi = require('joi');

const guestContactSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  email: Joi.string().email().required()
    .messages({
      'string.email': 'Valid email address is required'
    }),
  phoneNumber: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).optional().allow('', null)
    .messages({
      'string.pattern.base': 'Phone number must be in international format (e.g., +250788123456) or leave empty'
    }),
  relationship: Joi.string().valid('family', 'friend', 'partner', 'colleague', 'other').optional()
}).min(2);

const sosTriggerSchema = Joi.object({
  location: Joi.object({
    latitude: Joi.number().min(-90).max(90).optional(),
    longitude: Joi.number().min(-180).max(180).optional(),
    address: Joi.string().max(500).optional(),
    accuracy: Joi.number().min(0).optional()
  }).optional(),
  fallbackLocation: Joi.string().max(500).optional().allow(''),
  customNote: Joi.string().max(500).optional().allow(''),
  wasOffline: Joi.boolean().optional(),
  metadata: Joi.object().optional(),
  guestContacts: Joi.array().items(guestContactSchema).min(1).max(10).optional()
    .when('guestSessionId', {
      is: Joi.exist(),
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
  guestSessionId: Joi.string().optional()
}).min(0);

module.exports = {
  sosTriggerSchema
};

