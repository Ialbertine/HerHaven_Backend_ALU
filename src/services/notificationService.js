const logger = require('../utils/logger');

class NotificationService {
  constructor() {
    logger.info('Notification service initialized - in-app notifications only');
  }

  // notification methods
  async notifyAppointmentBooked(appointment, user, counselor) {
    logger.info(`Appointment booked notification: User ${user.username} booked with counselor ${counselor.firstName} ${counselor.lastName}`);
    return { success: true, message: 'In-app notification logged' };
  }

  async notifyAppointmentConfirmed(appointment, user, counselor) {
    logger.info(`Appointment confirmed notification: User ${user.username} appointment confirmed with ${counselor.firstName} ${counselor.lastName}`);
    return { success: true, message: 'In-app notification logged' };
  }

  async notifyAppointmentReminder(appointment, user, counselor, reminderType = '24h') {
    logger.info(`Appointment reminder notification: ${reminderType} reminder for User ${user.username} with ${counselor.firstName} ${counselor.lastName}`);
    return { success: true, message: 'In-app notification logged' };
  }

  async notifyAppointmentCancelled(appointment, user, counselor, cancelledBy, reason) {
    logger.info(`Appointment cancelled notification: User ${user.username} appointment cancelled by ${cancelledBy}, reason: ${reason}`);
    return { success: true, message: 'In-app notification logged' };
  }

  async notifySessionStarting(appointment, user, counselor) {
    logger.info(`Session starting notification: User ${user.username} session starting with ${counselor.firstName} ${counselor.lastName}`);
    return { success: true, message: 'In-app notification logged' };
  }

  async notifySessionCompleted(appointment, user, counselor) {
    logger.info(`Session completed notification: User ${user.username} session completed with ${counselor.firstName} ${counselor.lastName}`);
    return { success: true, message: 'In-app notification logged' };
  }

  // Placeholder methods for email/SMS that now only log
  async sendEmail(to, subject, htmlContent) {
    logger.info(`Email notification logged: To ${to}, Subject: ${subject}, Content: ${htmlContent ? 'provided' : 'none'}`);
    return { success: true, message: 'Email notification logged' };
  }

  async sendSMS(to, message) {
    logger.info(`SMS notification logged: To ${to}, Message: ${message}`);
    return { success: true, message: 'SMS notification logged' };
  }
}

module.exports = new NotificationService();