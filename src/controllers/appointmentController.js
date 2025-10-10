const mongoose = require("mongoose");
const crypto = require("crypto");
const moment = require("moment-timezone");
const Appointment = require("../models/appointment");
const Counselor = require("../models/counselor");
const notificationController = require("../controllers/notificationController");
const logger = require("../utils/logger");

const appointmentController = {
  // Book new appointment
  bookAppointment: async (req, res) => {
    try {
      const {
        counselorId,
        appointmentDate,
        appointmentTime,
        duration = 60,
        appointmentType = "individual",
        sessionMode = "video",
        reason,
        urgencyLevel = "medium",
      } = req.body;

      const userId = req.user._id;

      if (!mongoose.Types.ObjectId.isValid(counselorId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid counselor ID format",
        });
      }

      const counselor = await Counselor.findOne({
        _id: new mongoose.Types.ObjectId(counselorId),
        isVerified: true,
        isActive: true,
        isAvailable: true,
      });

      if (!counselor) {
        return res.status(404).json({
          success: false,
          message: "Counselor not found or not available for appointments",
        });
      }

      const startOfDay = new Date(appointmentDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(appointmentDate);
      endOfDay.setHours(23, 59, 59, 999);

      const existingAppointment = await Appointment.findOne({
        counselor: counselorId,
        appointmentDate: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
        appointmentTime: appointmentTime,
        status: { $in: ["confirmed", "pending"] },
      });

      if (existingAppointment) {
        return res.status(409).json({
          success: false,
          message:
            "Time slot is already booked. Please choose a different time.",
        });
      }

      // Create new appointment
      const appointment = new Appointment({
        user: userId,
        counselor: counselorId,
        appointmentDate: new Date(appointmentDate),
        appointmentTime,
        duration,
        appointmentType,
        sessionMode,
        reason: reason || "",
        urgencyLevel,
        status: "pending",
      });

      await appointment.save();

      await appointment.populate(
        "counselor",
        "username firstName lastName specialization"
      );
      await appointment.populate("user", "username email");

      // Create notification for appointment booked
      await notificationController.createNotification(
        userId,
        "appointment_booked",
        "Appointment Booked",
        `Your appointment with ${counselor.firstName} ${counselor.lastName} has been booked and is pending confirmation.`,
        {
          appointment: appointment._id,
          counselor: counselor._id,
          channels: ["inApp"],
        }
      );

      // Create notification for counselor
      await notificationController.createNotification(
        counselor._id,
        "appointment_booked",
        "New Appointment Request",
        `You have a new appointment request from ${req.user.username}.`,
        {
          appointment: appointment._id,
          user: userId,
          channels: ["inApp"],
        }
      );

      logger.info(
        `New appointment booked: User ${req.user.username} with Counselor ${counselor.username}`
      );

      res.status(201).json({
        success: true,
        message:
          "Appointment booked successfully. Waiting for counselor confirmation.",
        data: {
          appointment: {
            id: appointment._id,
            counselor: {
              id: appointment.counselor._id,
              name: `${appointment.counselor.firstName} ${appointment.counselor.lastName}`,
              username: appointment.counselor.username,
              specialization: appointment.counselor.specialization,
            },
            appointmentDate: appointment.appointmentDate,
            appointmentTime: appointment.appointmentTime,
            duration: appointment.duration,
            appointmentType: appointment.appointmentType,
            sessionMode: appointment.sessionMode,
            status: appointment.status,
            urgencyLevel: appointment.urgencyLevel,
            createdAt: appointment.createdAt,
          },
        },
      });
    } catch (error) {
      logger.error("Book appointment error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to book appointment",
        error: error.message,
      });
    }
  },

  // Get user's appointments
  getUserAppointments: async (req, res) => {
    try {
      const userId = req.user._id;
      const { status, upcoming } = req.query;

      const filter = { user: userId };

      if (status) {
        filter.status = status;
      }

      if (upcoming === "true") {
        filter.appointmentDate = { $gte: new Date() };
        filter.status = { $in: ["confirmed", "pending"] };
      }

      const appointments = await Appointment.find(filter)
        .populate("counselor", "username firstName lastName specialization")
        .sort({ appointmentDate: 1, appointmentTime: 1 });

      res.json({
        success: true,
        message: "User appointments retrieved",
        data: {
          appointments,
          count: appointments.length,
        },
      });
    } catch (error) {
      logger.error("Get user appointments error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve appointments",
      });
    }
  },

  // Get counselor's appointments
  getCounselorAppointments: async (req, res) => {
    try {
      const counselorId = req.user._id;
      const { status, date } = req.query;

      const filter = { counselor: counselorId };

      if (status) {
        filter.status = status;
      }

      if (date) {
        filter.appointmentDate = new Date(date);
      }

      const appointments = await Appointment.find(filter)
        .populate("user", "username email")
        .sort({ appointmentDate: 1, appointmentTime: 1 });

      res.json({
        success: true,
        message: "Counselor appointments retrieved",
        data: {
          appointments,
          count: appointments.length,
        },
      });
    } catch (error) {
      logger.error("Get counselor appointments error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve appointments",
      });
    }
  },

  // Confirm appointment (counselor)
  confirmAppointment: async (req, res) => {
    try {
      const { appointmentId } = req.params;
      const counselorId = req.user._id;

      const appointment = await Appointment.findOne({
        _id: appointmentId,
        counselor: counselorId,
        status: "pending",
      })
        .populate("user", "username email")
        .populate("counselor", "username firstName lastName");

      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: "Appointment not found or already processed",
        });
      }

      // Meeting details removed - no external video platform integration

      appointment.status = "confirmed";
      appointment.confirmedAt = new Date();

      // confirmation to remindersSent
      appointment.remindersSent.push('confirmation');

      await appointment.save();

      // Create notification for user
      await notificationController.createNotification(
        appointment.user._id,
        "appointment_confirmed",
        "Appointment Confirmed",
        `Your appointment with ${appointment.counselor.firstName} ${appointment.counselor.lastName} has been confirmed.`,
        {
          appointment: appointment._id,
          counselor: appointment.counselor._id,
          channels: ["inApp"],
        }
      );

      logger.info(
        `Appointment confirmed: ${appointmentId} by counselor ${req.user.username}`
      );

      res.json({
        success: true,
        message: "Appointment confirmed successfully",
        data: {
          appointment: {
            id: appointment._id,
            user: {
              username: appointment.user.username,
              email: appointment.user.email,
            },
            appointmentDate: appointment.appointmentDate,
            appointmentTime: appointment.appointmentTime,
            duration: appointment.duration,
            status: appointment.status,
            confirmedAt: appointment.confirmedAt,
          },
        },
      });
    } catch (error) {
      logger.error("Confirm appointment error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to confirm appointment",
      });
    }
  },

  // Reject appointment counselor
  rejectAppointment: async (req, res) => {
    try {
      const { appointmentId } = req.params;
      const { reason } = req.body;
      const counselorId = req.user._id;

      const appointment = await Appointment.findOne({
        _id: appointmentId,
        counselor: counselorId,
        status: "pending",
      });

      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: "Appointment not found or already processed",
        });
      }

      appointment.status = "cancelled";
      appointment.cancelledBy = "counselor";
      appointment.cancellationReason =
        reason || "Appointment rejected by counselor";
      appointment.cancelledAt = new Date();
      await appointment.save();

      logger.info(
        `Appointment rejected: ${appointmentId} by counselor ${req.user.username}`
      );

      res.json({
        success: true,
        message: "Appointment rejected",
        data: {
          appointmentId: appointment._id,
          status: appointment.status,
          cancellationReason: appointment.cancellationReason,
        },
      });
    } catch (error) {
      logger.error("Reject appointment error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to reject appointment",
      });
    }
  },

  // Cancel appointment user
  cancelAppointment: async (req, res) => {
    try {
      const { appointmentId } = req.params;
      const { reason } = req.body;
      const userId = req.user._id;

      const appointment = await Appointment.findOne({
        _id: appointmentId,
        user: userId,
        status: { $in: ["confirmed", "pending"] },
      });

      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: "Appointment not found or cannot be cancelled",
        });
      }

      // Check if appointment can be cancelled
      if (!appointment.canBeCancelled()) {
        return res.status(400).json({
          success: false,
          message:
            "Appointment cannot be cancelled less than 2 hours before scheduled time",
        });
      }

      appointment.status = "cancelled";
      appointment.cancelledBy = "user";
      appointment.cancellationReason = reason || "Cancelled by user";
      appointment.cancelledAt = new Date();
      await appointment.save();

      logger.info(
        `Appointment cancelled: ${appointmentId} by user ${req.user.username}`
      );

      res.json({
        success: true,
        message: "Appointment cancelled successfully",
        data: {
          appointmentId: appointment._id,
          status: appointment.status,
          cancellationReason: appointment.cancellationReason,
        },
      });
    } catch (error) {
      logger.error("Cancel appointment error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to cancel appointment",
      });
    }
  },

  // Get appointment details
  getAppointmentDetails: async (req, res) => {
    try {
      const { appointmentId } = req.params;
      const userId = req.user._id;

      const appointment = await Appointment.findOne({
        _id: appointmentId,
        user: userId,
      })
        .populate("counselor", "username firstName lastName specialization bio")
        .populate("user", "username email");

      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: "Appointment not found",
        });
      }

      res.json({
        success: true,
        message: "Appointment details retrieved",
        data: { appointment },
      });
    } catch (error) {
      logger.error("Get appointment details error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve appointment details",
      });
    }
  },

  // Get available time slots for a counselor
  getAvailableTimeSlots: async (req, res) => {
    try {
      const { counselorId } = req.params;
      const { date } = req.query;

      if (!date) {
        return res.status(400).json({
          success: false,
          message: "Date parameter is required",
        });
      }

      // Validate counselor exists
      const counselor = await Counselor.findOne({
        _id: counselorId,
        isVerified: true,
        isActive: true,
        isAvailable: true,
      });

      if (!counselor) {
        return res.status(404).json({
          success: false,
          message: "Counselor not found or not available",
        });
      }

      // Get booked time slots for the date
      const bookedAppointments = await Appointment.find({
        counselor: counselorId,
        appointmentDate: new Date(date),
        status: { $in: ["confirmed", "pending"] },
      }).select("appointmentTime duration");

      // this generate time slots from 9am to 6pm
      const availableSlots = [];
      const startHour = 9;
      const endHour = 18;

      for (let hour = startHour; hour < endHour; hour++) {
        const timeSlot = `${hour.toString().padStart(2, "0")}:00`;
        const isBooked = bookedAppointments.some(
          (apt) => apt.appointmentTime === timeSlot
        );

        if (!isBooked) {
          availableSlots.push({
            time: timeSlot,
            duration: 60,
            available: true,
          });
        }
      }

      res.json({
        success: true,
        message: "Available time slots retrieved",
        data: {
          counselor: {
            id: counselor._id,
            name: `${counselor.firstName} ${counselor.lastName}`,
            username: counselor.username,
            specialization: counselor.specialization,
          },
          date,
          availableSlots,
          totalSlots: availableSlots.length,
        },
      });
    } catch (error) {
      logger.error("Get available time slots error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve available time slots",
      });
    }
  },

  // Get meeting details for appointment
  getMeetingDetails: async (req, res) => {
    try {
      const { appointmentId } = req.params;
      const userId = req.user._id;

      const appointment = await Appointment.findOne({
        _id: appointmentId,
        user: userId,
        status: { $in: ["confirmed", "in-progress"] }, // Changed from just "confirmed"
      }).populate("counselor", "firstName lastName specialization");

      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: "Appointment not found or not confirmed",
        });
      }

      if (!appointment.meetingDetails) {
        return res.status(404).json({
          success: false,
          message: "Meeting details not available",
        });
      }

      res.json({
        success: true,
        message: "Meeting details retrieved",
        data: {
          appointment: {
            id: appointment._id,
            counselor: {
              name: `${appointment.counselor.firstName} ${appointment.counselor.lastName}`,
              specialization: appointment.counselor.specialization,
            },
            appointmentDate: appointment.appointmentDate,
            appointmentTime: appointment.appointmentTime,
            duration: appointment.duration,
          },
          meeting: {
            meetingId: appointment.meetingDetails.meetingId,
            meetingUrl: appointment.meetingDetails.meetingUrl,
            password: appointment.meetingDetails.password,
            startTime: appointment.meetingDetails.startTime,
          },
        },
      });
    } catch (error) {
      logger.error("Get meeting details error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve meeting details",
      });
    }
  },

  // Start session (counselor)
  startSession: async (req, res) => {
    try {
      const { appointmentId } = req.params;
      const counselorId = req.user._id;

      const appointment = await Appointment.findOne({
        _id: appointmentId,
        counselor: counselorId,
        status: "confirmed",
      }).populate("user", "username email");

      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: "Appointment not found or not confirmed",
        });
      }

      const appointmentDateTime = moment
        .tz(
          `${appointment.appointmentDate.toISOString().split("T")[0]} ${
            appointment.appointmentTime
          }`,
          "YYYY-MM-DD HH:mm",
          "Africa/Harare"
        )
        .toDate();

      // it's time to start within 15 minutes of scheduled time
      const now = new Date();
      const timeDiff = appointmentDateTime.getTime() - now.getTime();
      const minutesUntilStart = timeDiff / (1000 * 60);

      if (minutesUntilStart > 15) {
        return res.status(400).json({
          success: false,
          message:
            "Session can only be started 10 minutes before scheduled time",
          debug: {
            appointmentTime: appointmentDateTime.toISOString(),
            currentTime: now.toISOString(),
            minutesUntilStart,
          },
        });
      }

      const meetingDetails = {
        meetingId: `session-${appointment._id}`,
        meetingUrl: `https://meet.jit.si/herhaven-${appointment._id}-${crypto
          .randomBytes(8)
          .toString("hex")}`,
        roomName: `herhaven-${appointment._id}`,
        startTime: now.toISOString(),
        duration: appointment.duration,
      };

      appointment.status = "in-progress";
      appointment.actualStartTime = now;
      appointment.meetingDetails = meetingDetails;
      await appointment.save();

      // Create notification for user
      await notificationController.createNotification(
        appointment.user._id,
        "session_starting",
        "Session Starting",
        `Your session with ${req.user.firstName} ${req.user.lastName} is starting now.`,
        {
          appointment: appointment._id,
          counselor: req.user._id,
          channels: ["inApp"],
          data: {
            meetingLink: appointment.meetingDetails?.meetingUrl,
          },
        }
      );

      logger.info(
        `Session started: ${appointmentId} by counselor ${req.user.username}`
      );

      res.json({
        success: true,
        message: "Session started successfully",
        data: {
          appointmentId: appointment._id,
          status: appointment.status,
          startedAt: appointment.startedAt,
          meetingDetails: appointment.meetingDetails,
        },
      });
    } catch (error) {
      logger.error("Start session error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to start session",
      });
    }
  },

  // End session (counselor)
  endSession: async (req, res) => {
    try {
      const { appointmentId } = req.params;
      const { sessionNotes } = req.body;
      const counselorId = req.user._id;

      const appointment = await Appointment.findOne({
        _id: appointmentId,
        counselor: counselorId,
        status: "in-progress",
      }).populate("user", "username email");

      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: "Session not found or not in progress",
        });
      }

      appointment.status = "completed";
      appointment.endedAt = new Date();
      if (sessionNotes) {
        appointment.sessionNotes = sessionNotes;
      }
      await appointment.save();

      // Create notification for user
      await notificationController.createNotification(
        appointment.user._id,
        "session_completed",
        "Session Completed",
        `Your session with ${req.user.firstName} ${req.user.lastName} has been completed.`,
        {
          appointment: appointment._id,
          counselor: req.user._id,
          channels: ["inApp"],
        }
      );

      logger.info(
        `Session ended: ${appointmentId} by counselor ${req.user.username}`
      );

      res.json({
        success: true,
        message: "Session ended successfully",
        data: {
          appointmentId: appointment._id,
          status: appointment.status,
          endedAt: appointment.endedAt,
          sessionNotes: appointment.sessionNotes,
        },
      });
    } catch (error) {
      logger.error("End session error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to end session",
      });
    }
  },
};

module.exports = appointmentController;
