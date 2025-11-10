require("dotenv").config();
const twilio = require("twilio");
const logger = require("../utils/logger");

class SMSService {
  constructor() {
    this.isInitialized = false;
    this.client = null;
    this.initializeTwilio();
  }

  initializeTwilio() {
    try {
      // Check for Twilio credentials
      if (!process.env.TWILIO_ACCOUNT_SID) {
        logger.error("TWILIO_ACCOUNT_SID environment variable is required");
        return;
      }

      if (!process.env.TWILIO_AUTH_TOKEN) {
        logger.error("TWILIO_AUTH_TOKEN environment variable is required");
        return;
      }

      if (!process.env.TWILIO_PHONE_NUMBER) {
        logger.error("TWILIO_PHONE_NUMBER environment variable is required");
        return;
      }

      // Initialize Twilio client
      this.client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      this.isInitialized = true;

      logger.info("Twilio SMS service initialized successfully");
      logger.info(`Twilio phone number: ${process.env.TWILIO_PHONE_NUMBER}`);
    } catch (error) {
      logger.error(`Error initializing Twilio: ${error.message}`);
      this.isInitialized = false;
    }
  }

  /**
   * Validates phone number format (E.164 format)
   */
  isValidPhoneNumber(phoneNumber) {
    if (!phoneNumber || typeof phoneNumber !== "string") {
      return false;
    }
    // E.164 format: +[country code][number]
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber);
  }

  /**
   * Sends SMS message via Twilio
   */
  async sendSMS(to, message) {
    try {
      // Check if Twilio is initialized
      if (!this.isInitialized || !this.client) {
        const errorMsg =
          "Twilio not initialized. Check server logs for missing credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER).";
        logger.error(errorMsg);
        return {
          success: false,
          error: errorMsg,
        };
      }

      // Validate recipient phone number
      if (!this.isValidPhoneNumber(to)) {
        const errorMsg = `Invalid recipient phone number: ${to}. Must be in E.164 format (e.g., +250788123456)`;
        logger.error(errorMsg);
        return {
          success: false,
          error: errorMsg,
        };
      }

      // Validate message
      if (
        !message ||
        typeof message !== "string" ||
        message.trim().length === 0
      ) {
        const errorMsg = "Message body cannot be empty";
        logger.error(errorMsg);
        return {
          success: false,
          error: errorMsg,
        };
      }

      // Check message length
      if (message.length > 1600) {
        logger.warn(
          `Message length (${message.length}) exceeds recommended length. Twilio will split into multiple messages.`
        );
      }

      logger.info(`Attempting to send SMS via Twilio to: ${to}`);

      // Send SMS using Twilio
      const result = await this.client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: to,
      });

      logger.info(`SMS sent successfully to ${to}. SID: ${result.sid}`);

      return {
        success: true,
        messageId: result.sid,
        status: result.status,
      };
    } catch (error) {
      logger.error(`Failed to send SMS to ${to}:`, error);

      let userFriendlyMessage = "Failed to send SMS";
      if (error.code === 21211) {
        userFriendlyMessage = "Invalid phone number format";
      } else if (error.code === 21608) {
        userFriendlyMessage =
          "Unverified phone number. Please verify the number in Twilio console";
      } else if (error.code === 21408) {
        userFriendlyMessage =
          "Permission denied. Check Twilio account permissions";
      } else if (error.message) {
        userFriendlyMessage = error.message;
      }

      return {
        success: false,
        error: userFriendlyMessage,
        twilioError: error.code || error.message,
      };
    }
  }

  buildSOSMessage(user, context = {}) {
    const names = [user?.firstName, user?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
    const displayName = names || user?.username || user?.email || "Someone";

    let message = `URGENT SOS: ${displayName} needs help!\n`;

    // Add location if available
    if (context.location?.address) {
      const address =
        context.location.address.length > 50
          ? context.location.address.substring(0, 47) + "..."
          : context.location.address;
      message += `At: ${address}\n`;
    }

    // Add custom note if available
    if (context.customNote) {
      const note =
        context.customNote.length > 40
          ? context.customNote.substring(0, 37) + "..."
          : context.customNote;
      message += `Note: ${note}\n`;
    }

    // Add phone number if available
    const helpSeekerPhone =
      context.metadata?.phoneNumber || context.phoneNumber;
    if (helpSeekerPhone) {
      message += `Call: ${helpSeekerPhone}\n`;
    }

    // Add emergency numbers (shortened)
    message += `Emergency: 112, 3029`;

    return message;
  }
}

module.exports = new SMSService();
