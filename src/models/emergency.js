const mongoose = require("mongoose");
const logger = require("../utils/logger");
const Schema = mongoose.Schema;

const emergencyContactSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Contact name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    relationship: {
      type: String,
      required: [true, "Relationship is required"],
      enum: ["family", "friend", "partner", "colleague", "other"],
      default: "other",
    },
    phoneNumber: {
      type: String,
      required: [true, "Phone number is required for emergency alerts"],
      trim: true,
      validate: {
        validator: function (v) {
          if (!v) return false;
          return /^\d{10}$/.test(v);
        },
        message: "phone number must be 10 digits",
      },
    },
    notes: {
      type: String,
      maxlength: [500, "Notes cannot exceed 500 characters"],
    },
    consentGiven: {
      type: Boolean,
      default: true,
      required: true,
      immutable: true,
    },
  },
  {
    timestamps: true,
  }
);


const EmergencyContact = mongoose.model(
  "EmergencyContact",
  emergencyContactSchema
);

mongoose.connection.once("open", async () => {
  try {
    const indexes = await EmergencyContact.collection.indexes();
    const legacyIndexes = indexes.filter((index) => {
      if (!index.unique || !index.key) return false;

      const keyFields = Object.keys(index.key);
      return keyFields.some((field) =>
        ["phoneNumber", "email"].includes(field)
      );
    });

    for (const index of legacyIndexes) {
      await EmergencyContact.collection.dropIndex(index.name);
      logger.info(
        `Dropped legacy unique index '${index.name}' on EmergencyContact to remove obsolete uniqueness constraints.`
      );
    }
  } catch (error) {
    const ignoredErrors = ["IndexNotFound", "NamespaceNotFound"];
    if (!ignoredErrors.includes(error.codeName)) {
      logger.warn(
        `Could not adjust EmergencyContact phone number index: ${error.message}`
      );
    }
  }
});

module.exports = EmergencyContact;
