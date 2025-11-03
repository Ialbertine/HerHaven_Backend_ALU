const { sosTriggerSchema } = require('../validations/sosValidation');

/**
 * Validation middleware for SOS trigger requests
 */
const validateSOSTrigger = (req, res, next) => {
  const { error, value } = sosTriggerSchema.validate(req.body, {
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

module.exports = {
  validateSOSTrigger
};

