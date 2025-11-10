const sosService = require("../services/sosService");
const logger = require("../utils/logger");

class SOSController {
  async checkAccess(req, res) {
    try {
      if (!req.user) {
        return res.json({
          success: true,
          authenticated: false,
          isGuest: true,
          message:
            "Guest access available provide guestSessionId and guestContacts to trigger SOS",
          guestAccess: true,
        });
      }

      const EmergencyContact = require("../models/emergency");
      const contactCount = await EmergencyContact.countDocuments({
        userId: req.user._id,
        $or: [{ isActive: true }, { isActive: { $exists: false } }],
        consentGiven: true,
      });

      return res.json({
        success: true,
        authenticated: true,
        hasEmergencyContacts: contactCount > 0,
        contactCount,
        user: {
          id: req.user._id,
          email: req.user.email,
          username: req.user.username,
          role: req.user.role,
        },
        message:
          contactCount === 0
            ? "Please add emergency contacts first"
            : "Ready to send SOS",
      });
    } catch (error) {
      logger.error("Check SOS access error:", error);
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async quickTriggerSOS(req, res) {
    try {
      const {
        location,
        customNote,
        wasOffline,
        metadata,
        guestSessionId,
        guestContacts,
      } = req.body;

      if (req.user) {
        const userId = req.user._id;
        const EmergencyContact = require("../models/emergency");
        const contactCount = await EmergencyContact.countDocuments({
          userId,
          $or: [{ isActive: true }, { isActive: { $exists: false } }],
          consentGiven: true,
        });

        if (contactCount === 0) {
          return res.status(400).json({
            success: false,
            message: "No emergency contacts configured",
            hasEmergencyContacts: false,
            redirectTo: "/settings/emergency-contacts",
          });
        }

        const sos = await sosService.createSOSAlert(userId, {
          location,
          customNote,
          wasOffline,
          metadata,
        });

        return res.status(201).json({
          success: true,
          message: "SOS alert triggered successfully",
          data: sos,
          authenticated: true,
        });
      }

      if (!guestSessionId) {
        return res.status(400).json({
          success: false,
          message:
            "Guest session ID is required. Please provide guestSessionId in request body.",
          authenticated: false,
          redirectTo: "/auth/guest",
        });
      }

      const GuestSession = require("../models/guestSession");
      const guestSession = await GuestSession.findOne({
        sessionId: guestSessionId,
        isActive: true,
      });

      if (!guestSession) {
        return res.status(404).json({
          success: false,
          message:
            "Invalid or expired guest session. Please create a new guest session.",
          authenticated: false,
          redirectTo: "/auth/guest",
        });
      }

      guestSession.lastActivity = new Date();
      await guestSession.save();

      // If location is provided, it must include an address
      if (location && !location.address) {
        return res.status(400).json({
          success: false,
          message: "If location is provided, it must include an address.",
          authenticated: false,
        });
      }

      const sos = await sosService.createGuestSOSAlert(guestSessionId, {
        location: location || null,
        customNote,
        wasOffline,
        metadata,
        guestContacts,
      });

      return res.status(201).json({
        success: true,
        message: "SOS alert triggered successfully",
        data: sos,
        authenticated: false,
        isGuest: true,
      });
    } catch (error) {
      logger.error("Quick trigger SOS error:", error);
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async triggerSOS(req, res) {
    try {
      const userId = req.user._id;
      const { location, customNote, wasOffline, metadata } = req.body;

      const sos = await sosService.createSOSAlert(userId, {
        location,
        customNote,
        wasOffline,
        metadata,
      });

      return res.status(201).json({
        success: true,
        message: "SOS alert triggered successfully",
        data: sos,
      });
    } catch (error) {
      logger.error("Trigger SOS error:", error);
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async cancelSOS(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user._id;

      const sos = await sosService.cancelSOSAlert(id, userId);

      return res.json({
        success: true,
        message: "SOS alert cancelled successfully",
        data: sos,
      });
    } catch (error) {
      logger.error("Cancel SOS error:", error);
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
}

module.exports = new SOSController();
