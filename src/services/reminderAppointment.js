const cron = require('node-cron');
const Appointment = require('../models/appointment');
const notificationController = require('../controllers/notificationController');
const moment = require('moment-timezone');
const logger = require('../utils/logger');

const appointmentReminderService = {
  // Start the reminder service
  start: () => {
    cron.schedule('*/15 * * * *', async () => {
      try {
        await appointmentReminderService.sendReminders();
      } catch (error) {
        logger.error('Reminder service error:', error);
      }
    });

    logger.info('Appointment reminder service started');
  },

  // Send reminders for upcoming appointments
  sendReminders: async () => {
    try {
      const now = moment.tz('Africa/Harare');
      const in24Hours = moment.tz('Africa/Harare').add(24, 'hours');

      // Find confirmed appointments in the next 24 hours
      const appointments = await Appointment.find({
        status: 'confirmed',
        appointmentDate: {
          $gte: now.startOf('day').toDate(),
          $lte: in24Hours.endOf('day').toDate()
        }
      }).populate('user counselor');

      for (const appointment of appointments) {
        const appointmentTime = moment.tz(
          `${appointment.appointmentDate.toISOString().split('T')[0]} ${appointment.appointmentTime}`,
          'YYYY-MM-DD HH:mm',
          'Africa/Harare'
        );

        // 24 hours reminder
        if (!appointment.remindersSent.includes('24h')) {
          const hoursUntil = appointmentTime.diff(now, 'hours', true);
          if (hoursUntil <= 24 && hoursUntil > 23) {
            await notificationController.createNotification(
              appointment.user._id,
              'appointment_reminder',
              'Appointment Reminder',
              `You have an appointment tomorrow at ${appointment.appointmentTime} with ${appointment.counselor.firstName} ${appointment.counselor.lastName}`,
              { 
                appointment: appointment._id, 
                counselor: appointment.counselor._id,
                channels: ['inApp'] 
              }
            );

            appointment.remindersSent.push('24h');
            await appointment.save();
            logger.info(`24h reminder sent for appointment ${appointment._id}`);
          }
        }

        // one hour reminder
        if (!appointment.remindersSent.includes('1h')) {
          const minutesUntil = appointmentTime.diff(now, 'minutes', true);
          if (minutesUntil <= 60 && minutesUntil > 45) {
            await notificationController.createNotification(
              appointment.user._id,
              'appointment_reminder',
              'Appointment Starting Soon',
              `Your appointment starts in 1 hour at ${appointment.appointmentTime}`,
              { 
                appointment: appointment._id,
                counselor: appointment.counselor._id,
                channels: ['inApp'] 
              }
            );

            // Also notify counselor
            await notificationController.createNotification(
              appointment.counselor._id,
              'appointment_reminder',
              'Appointment Starting Soon',
              `Your appointment session with ${appointment.user.username} starts in 1 hour`,
              { 
                appointment: appointment._id,
                user: appointment.user._id,
                channels: ['inApp'] 
              }
            );

            appointment.remindersSent.push('1h');
            await appointment.save();
            logger.info(`1h reminder sent for appointment ${appointment._id}`);
          }
        }

        // 30 minutes reminder
        if (!appointment.remindersSent.includes('30min')) {
          const minutesUntil = appointmentTime.diff(now, 'minutes', true);
          if (minutesUntil <= 30 && minutesUntil > 15) {
            await notificationController.createNotification(
              appointment.user._id,
              'appointment_reminder',
              'Appointment Starting Very Soon',
              `Your appointment starts in 30 minutes at ${appointment.appointmentTime}. Please be ready!`,
              { 
                appointment: appointment._id,
                counselor: appointment.counselor._id,
                channels: ['inApp'] 
              }
            );

            // Also notify counselor
            await notificationController.createNotification(
              appointment.counselor._id,
              'appointment_reminder',
              'Appointment Starting Very Soon',
              `Your appointment session with ${appointment.user.username} starts in 30 minutes`,
              { 
                appointment: appointment._id,
                user: appointment.user._id,
                channels: ['inApp'] 
              }
            );

            appointment.remindersSent.push('30min');
            await appointment.save();
            logger.info(`Reminder sent for appointment ${appointment._id}`);
          }
        }
      }
    } catch (error) {
      logger.error('Send reminders error:', error);
      throw error;
    }
  }
};

module.exports = appointmentReminderService;