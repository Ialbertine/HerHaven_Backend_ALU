const Joi = require('joi');

const registerValidation = Joi.object({
  email: Joi.string().email().required().normalize(),
  password: Joi.string().min(6).required(),
  username: Joi.string().min(3).max(30).pattern(/^[a-zA-Z0-9_]+$/).required().trim()
});

const loginValidation = Joi.object({
  email: Joi.string().email().required().normalize(),
  password: Joi.string().required()
});

const guestAccessValidation = Joi.object({
  userAgent: Joi.string().optional().allow(''),
  ipAddress: Joi.string().ip().required()
});

// Counselor registration validation
const counselorRegisterValidation = Joi.object({
  email: Joi.string().email().required().normalize(),
  password: Joi.string().min(6).required(),
  username: Joi.string().min(3).max(30).pattern(/^[a-zA-Z0-9_]+$/).required().trim(),
  firstName: Joi.string().min(1).max(50).required().trim(),
  lastName: Joi.string().min(1).max(50).required().trim(),
  phoneNumber: Joi.string().required().trim(),
  licenseNumber: Joi.string().required().trim(),
  specialization: Joi.string().valid(
    'Trauma Counseling',
    'Crisis Intervention',
    'Domestic Violence',
    'Sexual Assault',
    'Mental Health',
    'Family Counseling',
    'Child Psychology',
    'Substance Abuse',
    'General Counseling'
  ).required(),
  experience: Joi.number().min(0).required(),
  bio: Joi.string().max(500).optional().allow('')
});

// Admin registration validation
const adminRegisterValidation = Joi.object({
  email: Joi.string().email().required().normalize(),
  password: Joi.string().min(6).required(),
  username: Joi.string().min(3).max(30).pattern(/^[a-zA-Z0-9_]+$/).required().trim(),
  firstName: Joi.string().min(1).max(50).required().trim(),
  lastName: Joi.string().min(1).max(50).required().trim(),
  phoneNumber: Joi.string().required().trim(),
  role: Joi.string().valid('super_admin', 'admin', 'moderator').default('admin'),
  permissions: Joi.array().items(Joi.string().valid(
    'approve_counselors',
    'manage_users',
    'view_analytics',
    'manage_content',
    'system_settings'
  )).optional()
});

// Admin onboarding validation (same as counselor registration but for admin use)
const adminOnboardValidation = Joi.object({
  email: Joi.string().email().required().normalize(),
  password: Joi.string().min(6).required(),
  username: Joi.string().min(3).max(30).pattern(/^[a-zA-Z0-9_]+$/).required().trim(),
  firstName: Joi.string().min(1).max(50).required().trim(),
  lastName: Joi.string().min(1).max(50).required().trim(),
  phoneNumber: Joi.string().required().trim(),
  licenseNumber: Joi.string().required().trim(),
  specialization: Joi.string().valid(
    'Trauma Counseling',
    'Crisis Intervention',
    'Domestic Violence',
    'Sexual Assault',
    'Mental Health',
    'Family Counseling',
    'Child Psychology',
    'Substance Abuse',
    'General Counseling'
  ).required(),
  experience: Joi.number().min(0).required(),
  bio: Joi.string().max(500).optional().allow('')
});

module.exports = {
  registerValidation,
  loginValidation,
  guestAccessValidation,
  counselorRegisterValidation,
  adminRegisterValidation,
  adminOnboardValidation
};