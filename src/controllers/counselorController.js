const Counselor = require('../models/counselor');
const Appointment = require('../models/appointment');
const SecurityUtils = require('../utils/security');
const logger = require('../utils/logger');

const counselorController = {
  // Self-registration for counselors (pending admin approval)
  register: async (req, res) => {
    try {
      const {
        email, password, username, firstName, lastName, phoneNumber,
        licenseNumber, specialization, experience, bio
      } = req.body;

      // Check if counselor already exists by email
      const existingCounselorByEmail = await Counselor.findOne({ email });
      if (existingCounselorByEmail) {
        return res.status(400).json({
          success: false,
          message: 'Counselor already exists with this email'
        });
      }

      // Check if username already exists
      const existingCounselorByUsername = await Counselor.findOne({ username });
      if (existingCounselorByUsername) {
        return res.status(400).json({
          success: false,
          message: 'Username already taken'
        });
      }

      // Check if license number already exists
      const existingLicense = await Counselor.findOne({ licenseNumber });
      if (existingLicense) {
        return res.status(400).json({
          success: false,
          message: 'License number already registered'
        });
      }

      // Validate password strength
      if (!SecurityUtils.isStrongPassword(password)) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long and contain uppercase, lowercase letters and numbers'
        });
      }

      // Create new counselor with pending status
      const counselor = new Counselor({
        email: SecurityUtils.sanitizeUserInput(email),
        password,
        username: SecurityUtils.sanitizeUserInput(username),
        firstName: SecurityUtils.sanitizeUserInput(firstName),
        lastName: SecurityUtils.sanitizeUserInput(lastName),
        phoneNumber: SecurityUtils.sanitizeUserInput(phoneNumber),
        licenseNumber: SecurityUtils.sanitizeUserInput(licenseNumber),
        specialization,
        experience,
        bio: SecurityUtils.sanitizeUserInput(bio || ''),
        verificationStatus: 'pending',
        isVerified: false
      });

      await counselor.save();

      logger.info(`New counselor self-registered: ${counselor.email} - Status: Pending Approval`);

      res.status(201).json({
        success: true,
        message: 'Counselor registration submitted successfully. Your account is pending admin approval.',
        data: {
          counselor: {
            id: counselor._id,
            email: counselor.email,
            username: counselor.username,
            specialization: counselor.specialization,
            verificationStatus: counselor.verificationStatus,
            submittedAt: counselor.createdAt
          }
        }
      });

    } catch (error) {
      logger.error('Counselor registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Counselor registration failed'
      });
    }
  },

  // Get counselor profile (for verified counselors)
  getProfile: async (req, res) => {
    try {
      const counselor = req.counselor;

      res.json({
        success: true,
        message: 'Counselor profile retrieved',
        data: {
          counselor: {
            id: counselor._id,
            email: counselor.email,
            username: counselor.username,
            firstName: counselor.firstName,
            lastName: counselor.lastName,
            specialization: counselor.specialization,
            experience: counselor.experience,
            bio: counselor.bio,
            totalSessions: counselor.totalSessions,
            averageRating: counselor.averageRating,
            isAvailable: counselor.isAvailable,
            isVerified: counselor.isVerified
          }
        }
      });

    } catch (error) {
      logger.error('Get counselor profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve counselor profile'
      });
    }
  },

  // Update counselor availability
  updateAvailability: async (req, res) => {
    try {
      const { isAvailable } = req.body;
      const counselor = req.counselor;

      counselor.isAvailable = isAvailable;
      await counselor.save();

      logger.info(`Counselor ${counselor.email} availability updated to: ${isAvailable}`);

      res.json({
        success: true,
        message: 'Availability updated successfully',
        data: {
          isAvailable: counselor.isAvailable
        }
      });

    } catch (error) {
      logger.error('Update availability error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update availability'
      });
    }
  },

  // Get all counselors (for users to browse)
  getAllCounselors: async (req, res) => {
    try {
      const { specialization, isAvailable } = req.query;

      const filter = {
        isVerified: true,
        isActive: true
      };

      if (specialization) {
        filter.specialization = specialization;
      }

      if (isAvailable !== undefined) {
        filter.isAvailable = isAvailable === 'true';
      }

      const counselors = await Counselor.find(filter)
        .select('username firstName lastName specialization experience bio averageRating isAvailable')
        .sort({ averageRating: -1, experience: -1 });

      res.json({
        success: true,
        message: 'Counselors retrieved successfully',
        data: {
          counselors,
          count: counselors.length
        }
      });

    } catch (error) {
      logger.error('Get counselors error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve counselors'
      });
    }
  },

  // Get counselor by ID (for appointment booking)
  getCounselorById: async (req, res) => {
    try {
      const { counselorId } = req.params;

      const counselor = await Counselor.findOne({
        _id: counselorId,
        isVerified: true,
        isActive: true
      }).select('username firstName lastName specialization experience bio averageRating isAvailable totalSessions');

      if (!counselor) {
        return res.status(404).json({
          success: false,
          message: 'Counselor not found or not available'
        });
      }

      res.json({
        success: true,
        message: 'Counselor details retrieved',
        data: { counselor }
      });

    } catch (error) {
      logger.error('Get counselor by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve counselor details'
      });
    }
  },

  // Get counselor specializations (for filtering)
  getSpecializations: async (req, res) => {
    try {
      const specializations = await Counselor.distinct('specialization', {
        isVerified: true,
        isActive: true
      });

      res.json({
        success: true,
        message: 'Specializations retrieved',
        data: { specializations }
      });

    } catch (error) {
      logger.error('Get specializations error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve specializations'
      });
    }
  },

  // Get counselor's pending appointment requests
  getPendingAppointments: async (req, res) => {
    try {
      const counselorId = req.counselor._id;

      const pendingAppointments = await Appointment.find({
        counselor: counselorId,
        status: 'pending'
      }).populate('user', 'username email')
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        message: 'Pending appointments retrieved',
        data: {
          appointments: pendingAppointments,
          count: pendingAppointments.length
        }
      });

    } catch (error) {
      logger.error('Get pending appointments error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve pending appointments'
      });
    }
  },

  // Get counselor's appointment statistics
  getAppointmentStats: async (req, res) => {
    try {
      const counselorId = req.counselor._id;

      const stats = await Appointment.aggregate([
        { $match: { counselor: counselorId } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const totalAppointments = await Appointment.countDocuments({ counselor: counselorId });
      const completedAppointments = await Appointment.countDocuments({
        counselor: counselorId,
        status: 'completed'
      });
      const pendingAppointments = await Appointment.countDocuments({
        counselor: counselorId,
        status: 'pending'
      });

      res.json({
        success: true,
        message: 'Appointment statistics retrieved',
        data: {
          stats: {
            total: totalAppointments,
            completed: completedAppointments,
            pending: pendingAppointments,
            breakdown: stats
          }
        }
      });

    } catch (error) {
      logger.error('Get appointment stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve appointment statistics'
      });
    }
  }
};

module.exports = counselorController;
