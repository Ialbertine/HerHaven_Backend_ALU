require('dotenv').config();
const twilio = require('twilio');
const logger = require('../utils/logger');

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
        logger.error('TWILIO_ACCOUNT_SID environment variable is required');
        return;
      }

      if (!process.env.TWILIO_AUTH_TOKEN) {
        logger.error('TWILIO_AUTH_TOKEN environment variable is required');
        return;
      }

      if (!process.env.TWILIO_PHONE_NUMBER) {
        logger.error('TWILIO_PHONE_NUMBER environment variable is required');
        return;
      }

      // Initialize Twilio client
      this.client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      this.isInitialized = true;

      logger.info('Twilio SMS service initialized successfully');
      logger.info(`Twilio phone number: ${process.env.TWILIO_PHONE_NUMBER}`);
    } catch (error) {
      logger.error(`Error initializing Twilio: ${error.message}`);
      this.isInitialized = false;
    }
  }

  /**
   * Validates phone number format (E.164 format)
   * @param {string} phoneNumber - Phone number to validate
   * @returns {boolean} - True if valid
   */
  isValidPhoneNumber(phoneNumber) {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return false;
    }
    // E.164 format: +[country code][number]
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber);
  }

  /**
   * Sends SMS message
   * @param {string} to - Recipient phone number (E.164 format)
   * @param {string} message - Message body
   * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
   */
  async sendSMS(to, message) {
    try {
      // Check if Twilio is initialized
      if (!this.isInitialized || !this.client) {
        const errorMsg = 'Twilio not initialized. Check server logs.';
        logger.error(errorMsg);
        return {
          success: false,
          error: errorMsg
        };
      }

      // Validate recipient phone number
      if (!this.isValidPhoneNumber(to)) {
        const errorMsg = `Invalid recipient phone number: ${to}. Must be in E.164 format (e.g., +250788123456)`;
        logger.error(errorMsg);
        return {
          success: false,
          error: errorMsg
        };
      }

      // Validate message
      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        const errorMsg = 'Message body cannot be empty';
        logger.error(errorMsg);
        return {
          success: false,
          error: errorMsg
        };
      }

      // Check message length (Twilio limit is 1600 characters for a single SMS)
      if (message.length > 1600) {
        logger.warn(`Message length (${message.length}) exceeds recommended length. Twilio will split into multiple messages.`);
      }

      logger.info(`Attempting to send SMS via Twilio to: ${to}`);

      // Send SMS using Twilio
      const result = await this.client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: to
      });

      logger.info(`SMS sent successfully to ${to}. SID: ${result.sid}`);

      return {
        success: true,
        messageId: result.sid,
        status: result.status
      };
    } catch (error) {
      logger.error(`Failed to send SMS to ${to}:`, error);

      let userFriendlyMessage = 'Failed to send SMS';
      if (error.code === 21211) {
        userFriendlyMessage = 'Invalid phone number format';
      } else if (error.code === 21608) {
        userFriendlyMessage = 'Unverified phone number. Please verify the number in Twilio console';
      } else if (error.code === 21408) {
        userFriendlyMessage = 'Permission denied. Check Twilio account permissions';
      } else if (error.message) {
        userFriendlyMessage = error.message;
      }

      return {
        success: false,
        error: userFriendlyMessage,
        twilioError: error.code || error.message
      };
    }
  }

  /**
   * Builds SOS alert SMS message
   * @param {object} user - User object with name/username
   * @param {object} context - Context with location, customNote, etc.
   * @returns {string} - Formatted SMS message
   */
  buildSOSMessage(user, context = {}) {
    const names = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
    const displayName = names || user?.username || user?.email || 'Someone';

    let message = `🚨 URGENT SOS ALERT\n\n`;
    message += `${displayName} needs immediate assistance!\n\n`;

    // Add location information
    if (context.location?.address) {
      message += `Location: ${context.location.address}\n`;
      message += `Map: https://maps.google.com/?q=${encodeURIComponent(context.location.address)}\n\n`;
    } else {
      message += `Location not available\n\n`;
    }

    // Add custom note if available
    if (context.customNote) {
      message += `Message: ${context.customNote}\n\n`;
    }

    // Add phone number if available
    const helpSeekerPhone = context.metadata?.phoneNumber || context.phoneNumber;
    if (helpSeekerPhone) {
      message += `📞 Call: ${helpSeekerPhone}\n\n`;
    }

    // Add emergency numbers
    message += `Emergency Services:\n`;
    message += `3029, 112, or 3212\n\n`;

    message += `Alert Time: ${new Date().toLocaleString()}\n`;
    message += `\nPlease respond immediately!`;

    return message;
  }
}

module.exports = new SMSService();

