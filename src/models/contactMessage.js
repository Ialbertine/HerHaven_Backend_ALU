const mongoose = require('mongoose');

const contactMessageSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ['new', 'in_progress', 'resolved', 'archived'],
      default: 'new',
    },
    respondedAt: {
      type: Date,
    },
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
    adminNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
  }
);

contactMessageSchema.index({ createdAt: -1 });
contactMessageSchema.index({ status: 1 });
contactMessageSchema.index({ email: 1 });

module.exports = mongoose.model('ContactMessage', contactMessageSchema);

