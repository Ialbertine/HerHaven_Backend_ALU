const logger = require('../utils/logger');
const emailService = require('./emailService');

class NotificationService {
  constructor() {
    logger.info('Notification service initialized - email notifications enabled');
  }

  // Tells user their appointment was booked
  async notifyAppointmentBooked(appointment, user, counselor) {
    logger.info(`Appointment booked notification: User ${user.username} booked with counselor ${counselor.firstName} ${counselor.lastName}`);
    return { success: true, message: 'Appointment booked notification logged' };
  }

  // Tells user their appointment was confirmed
  async notifyAppointmentConfirmed(appointment, user, counselor) {
    logger.info(`Appointment confirmed notification: User ${user.username} appointment confirmed with ${counselor.firstName} ${counselor.lastName}`);
    return { success: true, message: 'Appointment confirmed notification logged' };
  }

  // Reminds user about upcoming appointment
  async notifyAppointmentReminder(appointment, user, counselor, reminderType = '24h') {
    logger.info(`Appointment reminder notification: ${reminderType} reminder for User ${user.username} with ${counselor.firstName} ${counselor.lastName}`);
    return { success: true, message: 'Appointment reminder notification logged' };
  }

  // Tells user their appointment was cancelled
  async notifyAppointmentCancelled(appointment, user, counselor, cancelledBy, reason) {
    logger.info(`Appointment cancelled notification: User ${user.username} appointment cancelled by ${cancelledBy}, reason: ${reason}`);
    return { success: true, message: 'Appointment cancelled notification logged' };
  }

  // Tells user their session is starting
  async notifySessionStarting(appointment, user, counselor) {
    logger.info(`Session starting notification: User ${user.username} session starting with ${counselor.firstName} ${counselor.lastName}`);
    return { success: true, message: 'Session starting notification logged' };
  }

  // Tells user their session is completed
  async notifySessionCompleted(appointment, user, counselor) {
    logger.info(`Session completed notification: User ${user.username} session completed with ${counselor.firstName} ${counselor.lastName}`);
    return { success: true, message: 'Session completed notification logged' };
  }

  // Sends a generic email
  async sendEmail(to, subject, htmlContent) {
    try {
      const result = await emailService.sendEmail(to, subject, htmlContent);
      logger.info(`Email notification sent: To ${to}, Subject: ${subject}, Success: ${result.success}`);
      return result;
    } catch (error) {
      logger.error(`Failed to send email to ${to}:`, error);
      return { success: false, message: 'Failed to send email', error: error.message };
    }
  }

  // Welcomes new counselor after registration
  async sendCounselorRegistrationConfirmation(counselor) {
    try {
      const result = await emailService.sendCounselorRegistrationConfirmation(counselor);
      logger.info(`Counselor registration confirmation sent to ${counselor.email}: ${result.success}`);
      return result;
    } catch (error) {
      logger.error(`Failed to send counselor registration confirmation:`, error);
      return { success: false, message: 'Failed to send registration confirmation', error: error.message };
    }
  }

  // Celebrates counselor approval
  async sendCounselorApprovalNotification(counselor, approvedByAdmin) {
    try {
      const result = await emailService.sendCounselorApprovalNotification(counselor, approvedByAdmin);
      logger.info(`Counselor approval notification sent to ${counselor.email}: ${result.success}`);
      return result;
    } catch (error) {
      logger.error(`Failed to send counselor approval notification:`, error);
      return { success: false, message: 'Failed to send approval notification', error: error.message };
    }
  }

  // Notifies counselor about rejection
  async sendCounselorRejectionNotification(counselor, rejectionReason, rejectedByAdmin) {
    try {
      const result = await emailService.sendCounselorRejectionNotification(counselor, rejectionReason, rejectedByAdmin);
      logger.info(`Counselor rejection notification sent to ${counselor.email}: ${result.success}`);
      return result;
    } catch (error) {
      logger.error(`Failed to send counselor rejection notification:`, error);
      return { success: false, message: 'Failed to send rejection notification', error: error.message };
    }
  }

  // Alerts admin about new counselor application
  async sendAdminNewApplicationAlert(counselor, adminEmail) {
    try {
      const result = await emailService.sendAdminNewApplicationAlert(counselor, adminEmail);
      logger.info(`Admin new application alert sent to ${adminEmail}: ${result.success}`);
      return result;
    } catch (error) {
      logger.error(`Failed to send admin new application alert:`, error);
      return { success: false, message: 'Failed to send admin alert', error: error.message };
    }
  }
}

module.exports = new NotificationService();