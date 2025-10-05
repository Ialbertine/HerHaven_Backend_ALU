const Joi = require('joi');

// Appointment booking validation
const appointmentBookingValidation = Joi.object({
  counselorId: Joi.string().required(),
  appointmentDate: Joi.date().min('now').required(),
  appointmentTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
  duration: Joi.number().min(30).max(180).default(60),
  appointmentType: Joi.string().valid('individual', 'group', 'crisis', 'follow-up').default('individual'),
  sessionMode: Joi.string().valid('video', 'audio', 'chat', 'in-person').default('video'),
  reason: Joi.string().max(500).optional().allow(''),
  urgencyLevel: Joi.string().valid('low', 'medium', 'high', 'crisis').default('medium')
});

// Appointment cancellation validation
const appointmentCancellationValidation = Joi.object({
  reason: Joi.string().max(200).optional().allow('')
});

// Appointment rejection validation (for counselors)
const appointmentRejectionValidation = Joi.object({
  reason: Joi.string().max(200).required()
});

// Time slot availability validation
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
