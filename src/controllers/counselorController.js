const Counselor = require('../models/counselor');
const Appointment = require('../models/appointment');
const Admin = require('../models/admin');
const SecurityUtils = require('../utils/security');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');

const counselorController = {
  // registration for counselors for waiting approval
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

      // Send confirmation email to counselor
      try {
        await notificationService.sendCounselorRegistrationConfirmation(counselor);
        logger.info(`Registration confirmation email sent to ${counselor.email}`);
      } catch (emailError) {
        logger.error(`Failed to send registration confirmation email to ${counselor.email}:`, emailError);
      }

      // Send notification email to admins
      try {
        const admins = await Admin.find({
          isActive: true,
          permissions: { $in: ['approve_counselors'] }
        });

        for (const admin of admins) {
          await notificationService.sendAdminNewApplicationAlert(counselor, admin.email);
          logger.info(`New application alert sent to admin: ${admin.email}`);
        }
      } catch (adminEmailError) {
        logger.error('Failed to send admin notification emails:', adminEmailError);
      }

      logger.info(`New counselor self-registered: ${counselor.email} - Status: Pending Approval`);

      res.status(201).json({
        success: true,
        message: 'Counselor registration submitted successfully. Please check your email for confirmation.',
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
        message: 'Counselor registration failed',
        error: error.message
      });
    }
  },

  // Update counselor profile 
  updateProfile: async (req, res) => {
    try {
      const counselorId = req.user._id;
      const { username, phoneNumber, profilePicture } = req.body;
      const updateData = {};
      
      if (username !== undefined) {
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
          return res.status(400).json({
            success: false,
            message: 'Username can only contain letters, numbers, and underscores'
          });
        }
        
        if (username.length < 3 || username.length > 30) {
          return res.status(400).json({
            success: false,
            message: 'Username must be between 3 and 30 characters'
          });
        }

        // Check if username is already taken
        const existingCounselor = await Counselor.findOne({ 
          username, 
          _id: { $ne: counselorId } 
        });
        
        if (existingCounselor) {
          return res.status(409).json({
            success: false,
            message: 'Username is already taken'
          });
        }
        
        updateData.username = username;
      }

      if (phoneNumber !== undefined) {
        updateData.phoneNumber = phoneNumber;
      }

      if (profilePicture !== undefined) {
        updateData.profilePicture = profilePicture;
      }

      // Check for empty update
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid fields provided for update'
        });
      }

      const updatedCounselor = await Counselor.findByIdAndUpdate(
        counselorId,
        { $set: updateData },
        { 
          new: true, 
          runValidators: true,
          select: '-password -inviteToken -loginAttempts -lockUntil'
        }
      );

      if (!updatedCounselor) {
        return res.status(404).json({
          success: false,
          message: 'Counselor not found'
        });
      }
      logger.info(`Counselor profile updated: ${updatedCounselor.username}`);

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          counselor: {
            id: updatedCounselor._id,
            username: updatedCounselor.username,
            email: updatedCounselor.email,
            firstName: updatedCounselor.firstName,
            lastName: updatedCounselor.lastName,
            phoneNumber: updatedCounselor.phoneNumber,
            profilePicture: updatedCounselor.profilePicture,
            specialization: updatedCounselor.specialization,
            experience: updatedCounselor.experience,
            bio: updatedCounselor.bio,
            isVerified: updatedCounselor.isVerified,
            verificationStatus: updatedCounselor.verificationStatus
          }
        }
      });
    } catch (error) {
      logger.error('Update counselor profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update profile',
        error: error.message
      });
    }
  },


  // Get counselor profile for verified counselors
  getProfile: async (req, res) => {
    try {
      const counselorId = req.user._id;

      const counselor = await Counselor.findById(counselorId)
        .select('-password -inviteToken -loginAttempts -lockUntil');

      if (!counselor) {
        return res.status(404).json({
          success: false,
          message: 'Counselor not found'
        });
      }

      res.json({
        success: true,
        message: 'Profile retrieved successfully',
        data: { counselor }
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
      const { availability } = req.body;
      const counselorId = req.user._id;

      const counselor = await Counselor.findById(counselorId);

      if (!counselor) {
        return res.status(404).json({
          success: false,
          message: 'Counselor not found'
        });
      }

      counselor.availability = availability;
      await counselor.save();

      logger.info(`Counselor ${counselor.email} availability updated`);

      res.json({
        success: true,
        message: 'Availability updated successfully',
        data: {
          availability: counselor.availability
        }
      });

    } catch (error) {
      logger.error('Update availability error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update availability',
        error: error.message
      });
    }
  },

  // Get all counselors for user to browse and book
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
        message: 'Failed to retrieve counselors',
        error: error.message
      });
    }
  },

  // Get counselor by ID for appointment booking
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
        message: 'Failed to retrieve counselor details',
        error: error.message
      });
    }
  },

  // Get counselor specializations for filtering
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
      const counselorId = req.user._id;

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
      const counselorId = req.user._id;

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
