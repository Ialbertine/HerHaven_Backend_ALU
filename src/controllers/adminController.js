const Counselor = require('../models/counselor');
const User = require('../models/user');
const SecurityUtils = require('../utils/security');
const logger = require('../utils/logger');

const adminController = {
  // Admin onboarding - Create counselor directly (bypasses self-registration)
  onboardCounselor: async (req, res) => {
    try {
      const {
        email, password, username, firstName, lastName, phoneNumber,
        licenseNumber, specialization, experience, bio
      } = req.body;
      const admin = req.admin;

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

      // Create counselor directly with admin approval
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
        verificationStatus: 'approved', // Directly approved by admin
        isVerified: true,
        adminApprovedBy: admin._id,
        adminApprovedAt: new Date()
      });

      await counselor.save();

      // Update admin metrics
      admin.counselorsApproved += 1;
      await admin.save();

      logger.info(`Counselor ${counselor.email} onboarded directly by admin ${admin.email}`);

      res.status(201).json({
        success: true,
        message: 'Counselor onboarded successfully and is now available for appointments',
        data: {
          counselor: {
            id: counselor._id,
            email: counselor.email,
            username: counselor.username,
            firstName: counselor.firstName,
            lastName: counselor.lastName,
            specialization: counselor.specialization,
            experience: counselor.experience,
            isVerified: counselor.isVerified,
            verificationStatus: counselor.verificationStatus,
            onboardedAt: counselor.adminApprovedAt
          }
        }
      });

    } catch (error) {
      logger.error('Admin counselor onboarding error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to onboard counselor'
      });
    }
  },

  // Get all pending counselor applications
  getPendingCounselors: async (req, res) => {
    try {
      const pendingCounselors = await Counselor.find({
        verificationStatus: 'pending'
      }).select('-password');

      res.json({
        success: true,
        message: 'Pending counselors retrieved',
        data: {
          counselors: pendingCounselors,
          count: pendingCounselors.length
        }
      });

    } catch (error) {
      logger.error('Get pending counselors error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve pending counselors'
      });
    }
  },

  // Approve counselor application
  approveCounselor: async (req, res) => {
    try {
      const { counselorId } = req.params;
      const admin = req.admin;

      const counselor = await Counselor.findById(counselorId);
      if (!counselor) {
        return res.status(404).json({
          success: false,
          message: 'Counselor not found'
        });
      }

      if (counselor.verificationStatus !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Counselor application is not pending'
        });
      }

      // Update counselor status
      counselor.verificationStatus = 'approved';
      counselor.isVerified = true;
      counselor.adminApprovedBy = admin._id;
      counselor.adminApprovedAt = new Date();

      await counselor.save();

      // Update admin metrics
      admin.counselorsApproved += 1;
      await admin.save();

      logger.info(`Counselor ${counselor.email} approved by admin ${admin.email}`);

      res.json({
        success: true,
        message: 'Counselor approved successfully',
        data: {
          counselor: {
            id: counselor._id,
            email: counselor.email,
            username: counselor.username,
            verificationStatus: counselor.verificationStatus,
            approvedAt: counselor.adminApprovedAt
          }
        }
      });

    } catch (error) {
      logger.error('Approve counselor error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to approve counselor'
      });
    }
  },

  // Reject counselor application
  rejectCounselor: async (req, res) => {
    try {
      const { counselorId } = req.params;
      const { rejectionReason } = req.body;
      const admin = req.admin;

      const counselor = await Counselor.findById(counselorId);
      if (!counselor) {
        return res.status(404).json({
          success: false,
          message: 'Counselor not found'
        });
      }

      if (counselor.verificationStatus !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Counselor application is not pending'
        });
      }

      // Update counselor status
      counselor.verificationStatus = 'rejected';
      counselor.rejectionReason = rejectionReason || 'Application rejected by admin';
      counselor.adminApprovedBy = admin._id;
      counselor.adminApprovedAt = new Date();

      await counselor.save();

      // Update admin metrics
      admin.counselorsRejected += 1;
      await admin.save();

      logger.info(`Counselor ${counselor.email} rejected by admin ${admin.email}. Reason: ${rejectionReason}`);

      res.json({
        success: true,
        message: 'Counselor application rejected',
        data: {
          counselor: {
            id: counselor._id,
            email: counselor.email,
            verificationStatus: counselor.verificationStatus,
            rejectionReason: counselor.rejectionReason
          }
        }
      });

    } catch (error) {
      logger.error('Reject counselor error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reject counselor'
      });
    }
  },

  // Get all counselors (for admin management)
  getAllCounselors: async (req, res) => {
    try {
      const { verificationStatus, specialization } = req.query;

      const filter = {};
      if (verificationStatus) {
        filter.verificationStatus = verificationStatus;
      }
      if (specialization) {
        filter.specialization = specialization;
      }

      const counselors = await Counselor.find(filter)
        .select('-password')
        .populate('adminApprovedBy', 'username email')
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        message: 'Counselors retrieved successfully',
        data: {
          counselors,
          count: counselors.length
        }
      });

    } catch (error) {
      logger.error('Get all counselors error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve counselors'
      });
    }
  },

  // Get platform statistics
  getPlatformStats: async (req, res) => {
    try {
      const totalUsers = await User.countDocuments({ isActive: true });
      const totalCounselors = await Counselor.countDocuments({ isActive: true });
      const verifiedCounselors = await Counselor.countDocuments({
        isVerified: true,
        isActive: true
      });
      const pendingCounselors = await Counselor.countDocuments({
        verificationStatus: 'pending'
      });
      const rejectedCounselors = await Counselor.countDocuments({
        verificationStatus: 'rejected'
      });

      // Get counselor specializations distribution
      const specializationStats = await Counselor.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$specialization', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);

      // Get recent activity (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentRegistrations = await User.countDocuments({
        createdAt: { $gte: thirtyDaysAgo }
      });

      const recentCounselorApplications = await Counselor.countDocuments({
        createdAt: { $gte: thirtyDaysAgo }
      });

      const stats = {
        totalUsers,
        totalCounselors,
        verifiedCounselors,
        pendingCounselors,
        rejectedCounselors,
        verificationRate: totalCounselors > 0 ?
          ((verifiedCounselors / totalCounselors) * 100).toFixed(2) : 0,
        specializationStats,
        recentActivity: {
          userRegistrations: recentRegistrations,
          counselorApplications: recentCounselorApplications
        }
      };

      res.json({
        success: true,
        message: 'Platform statistics retrieved',
        data: { stats }
      });

    } catch (error) {
      logger.error('Get platform stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve platform statistics'
      });
    }
  },

  // Get admin dashboard overview
  getDashboardOverview: async (req, res) => {
    try {
      const admin = req.admin;

      // Get pending applications
      const pendingApplications = await Counselor.find({
        verificationStatus: 'pending'
      }).select('email username firstName lastName specialization experience createdAt')
        .sort({ createdAt: -1 })
        .limit(10);

      // Get recently approved counselors
      const recentlyApproved = await Counselor.find({
        verificationStatus: 'approved',
        adminApprovedAt: { $exists: true }
      }).select('email username firstName lastName specialization adminApprovedAt')
        .sort({ adminApprovedAt: -1 })
        .limit(5);

      // Get admin activity summary
      const adminStats = {
        counselorsApproved: admin.counselorsApproved,
        counselorsRejected: admin.counselorsRejected,
        lastActivity: admin.lastActivity
      };

      res.json({
        success: true,
        message: 'Dashboard overview retrieved',
        data: {
          pendingApplications,
          recentlyApproved,
          adminStats,
          totalPending: pendingApplications.length
        }
      });

    } catch (error) {
      logger.error('Get dashboard overview error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve dashboard overview'
      });
    }
  },

  // Deactivate counselor
  deactivateCounselor: async (req, res) => {
    try {
      const { counselorId } = req.params;
      const admin = req.admin;

      const counselor = await Counselor.findById(counselorId);
      if (!counselor) {
        return res.status(404).json({
          success: false,
          message: 'Counselor not found'
        });
      }

      counselor.isActive = false;
      await counselor.save();

      logger.info(`Counselor ${counselor.email} deactivated by admin ${admin.email}`);

      res.json({
        success: true,
        message: 'Counselor deactivated successfully',
        data: {
          counselor: {
            id: counselor._id,
            email: counselor.email,
            isActive: counselor.isActive
          }
        }
      });

    } catch (error) {
      logger.error('Deactivate counselor error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to deactivate counselor'
      });
    }
  }
};

module.exports = adminController;
