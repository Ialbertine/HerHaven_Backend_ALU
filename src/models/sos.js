const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const sosContactSchema = new Schema(
  {
    contactId: {
      type: Schema.Types.ObjectId,
      ref: "EmergencyContact",
      required: false,
    },
    status: {
      type: String,
      enum: ["pending", "sent", "failed"],
      default: "pending",
    },
    channel: {
      type: String,
      enum: ["sms"],
      default: "sms",
    },
    lastAttemptAt: {
      type: Date,
    },
    lastError: {
      type: String,
    },
    twilioSid: {
      type: String,
    },
    history: [
      {
        channel: {
          type: String,
          enum: ["sms", "call", "email"],
        },
        status: {
          type: String,
          enum: ["sent", "failed", "delivered", "undelivered"],
        },
        sentAt: {
          type: Date,
          default: Date.now,
        },
        metadata: {
          type: Schema.Types.Mixed,
        },
      },
    ],
    snapshot: {
      name: String,
      relationship: String,
      phoneNumber: String,
    },
  },
  { _id: false }
);

const sosSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },
    guestSessionId: {
      type: String,
      required: false,
      index: true,
    },
    isGuest: {
      type: Boolean,
      default: false,
    },
    guestContacts: [
      {
        name: {
          type: String,
          required: true,
        },
        phoneNumber: {
          type: String,
          required: true,
        },
        relationship: {
          type: String,
          default: "other",
        },
      },
    ],
    status: {
      type: String,
      enum: ["pending", "sent", "failed", "cancelled", "resolved"],
      default: "pending",
      index: true,
    },
    contacts: [sosContactSchema],
    location: {
      address: {
        type: String,
      },
    },
    customNote: {
      type: String,
      maxlength: 500,
    },
    wasOffline: {
      type: Boolean,
      default: false,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    triggeredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    cancelledAt: {
      type: Date,
    },
    resolvedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

sosSchema.index({ userId: 1, createdAt: -1 });
sosSchema.index({ userId: 1, status: 1 });
sosSchema.index({ status: 1, createdAt: -1 });

sosSchema.virtual("duration").get(function () {
  if (this.resolvedAt) {
    return this.resolvedAt - this.triggeredAt;
  }
  if (this.cancelledAt) {
    return this.cancelledAt - this.triggeredAt;
  }
  return Date.now() - this.triggeredAt;
});

sosSchema.statics.findActiveSOS = function (userId, guestSessionId = null) {
  const query = {
    status: { $in: ["pending", "sent"] },
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  };

  if (userId) {
    query.userId = userId;
  } else if (guestSessionId) {
    query.guestSessionId = guestSessionId;
  }

  return this.findOne(query).sort({ createdAt: -1 });
};

sosSchema.pre("save", function (next) {
  if (!this.userId && !this.guestSessionId) {
    return next(new Error("Either userId or guestSessionId must be provided"));
  }
  if (this.userId && this.guestSessionId) {
    return next(new Error("Cannot have both userId and guestSessionId"));
  }
  this.isGuest = !!this.guestSessionId;
  next();
});

const SOS = mongoose.model("SOS", sosSchema);

module.exports = SOS;
