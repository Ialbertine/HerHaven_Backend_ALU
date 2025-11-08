const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const emergencyContactSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Contact name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    relationship: {
      type: String,
      required: [true, 'Relationship is required'],
      enum: ['family', 'friend', 'partner', 'colleague', 'other'],
      default: 'other',
    },
    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required for emergency alerts'],
      trim: true,
      validate: {
        validator: function (v) {
          if (!v) return false;
          return /^\+[1-9]\d{1,14}$/.test(v);
        },
        message:
          'Phone number must be in international format (e.g., +250788123456)',
      },
    },
    notes: {
      type: String,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
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

emergencyContactSchema.index({ userId: 1, phoneNumber: 1 }, { unique: true });

const EmergencyContact = mongoose.model('EmergencyContact', emergencyContactSchema);

module.exports = EmergencyContact;