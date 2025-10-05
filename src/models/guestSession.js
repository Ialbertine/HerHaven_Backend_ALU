const mongoose = require('mongoose');

const guestSessionSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
        unique: true
    },
    ipAddress: {
        type: String,
        required: true
    },
    userAgent: {
        type: String
    },
    lastActivity: {
        type: Date,
        default: Date.now
    },
    isActive: {
        type: Boolean,
        default: true
    },
    accessedFeatures: [{
        feature: String,
        accessedAt: Date
    }]
}, {
    timestamps: true
});

// Auto-update lastActivity on save
guestSessionSchema.pre('save', function(next) {
    this.lastActivity = new Date();
    next();
});

// TTL index to automatically remove old sessions after 24 hours
guestSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model('GuestSession', guestSessionSchema);