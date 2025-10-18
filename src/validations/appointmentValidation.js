const Joi = require('joi');

// Appointment booking validation
const appointmentBookingValidation = Joi.object({
  counselorId: Joi.string().required(),
  firstName: Joi.string().trim().max(50).required().messages({
    'string.empty': 'First name is required',
    'any.required': 'First name is required'
  }),
  lastName: Joi.string().trim().max(50).required().messages({
    'string.empty': 'Last name is required',
    'any.required': 'Last name is required'
  }),
  phoneNumber: Joi.string().trim().pattern(/^[\d\s\-+()]+$/).required().messages({
    'string.empty': 'Phone number is required',
    'string.pattern.base': 'Please provide a valid phone number',
    'any.required': 'Phone number is required'
  }),
  appointmentDate: Joi.date().required(), //.min('now')
  appointmentTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
  duration: Joi.number().min(30).max(180).default(60),
  appointmentType: Joi.string().valid('individual', 'group', 'couple').default('individual'),
  sessionMode: Joi.string().valid('video', 'audio', 'chat', 'in-person').default('video'),
  reason: Joi.string().max(500).optional().allow(''),
  urgencyLevel: Joi.string().valid('low', 'medium', 'high').default('medium')
});

const appointmentCancellationValidation = Joi.object({
  reason: Joi.string().max(200).optional().allow('')
});

const appointmentRejectionValidation = Joi.object({
  reason: Joi.string().max(200).required()
});

const timeSlotValidation = Joi.object({
  date: Joi.date().min('now').required(),
  counselorId: Joi.string().required()
});

module.exports = {
  appointmentBookingValidation,
  appointmentCancellationValidation,
  appointmentRejectionValidation,
  timeSlotValidation
};
