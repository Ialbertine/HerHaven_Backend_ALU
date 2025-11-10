const Joi = require("joi");

const guestContactSchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  phoneNumber: Joi.string()
    .pattern(/^\d{10}$/)
    .required()
    .messages({
      "string.pattern.base": "Phone number must be 10 digits",
      "any.required": "Phone number is required",
    }),
  relationship: Joi.string()
    .valid("family", "friend", "partner", "colleague", "other")
    .optional(),
}).min(1);

const sosTriggerSchema = Joi.object({
  location: Joi.object({
    address: Joi.string().max(500).required(),
  }).optional(),
  customNote: Joi.string().max(500).optional().allow(""),
  wasOffline: Joi.boolean().optional(),
  metadata: Joi.object().optional(),
  guestContacts: Joi.array()
    .items(guestContactSchema)
    .min(1)
    .max(10)
    .optional()
    .when("guestSessionId", {
      is: Joi.exist(),
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  guestSessionId: Joi.string().optional(),
}).min(0);

module.exports = {
  sosTriggerSchema,
};
