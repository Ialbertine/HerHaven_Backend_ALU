const Counselor = require("../models/counselor");
const User = require("../models/user");
const SecurityUtils = require("../utils/security");
const notificationService = require("../services/notificationService");
const logger = require("../utils/logger");
const crypto = require("crypto");

const adminController = {
  // Invites counselor via email
  inviteCounselor: async (req, res) => {
    try {
      const { email, firstName, lastName } = req.body;
      const admin = req.admin;

      // Check if counselor already exists by email
      const existingCounselorByEmail = await Counselor.findOne({ email });
      if (existingCounselorByEmail) {
        return res.status(400).json({
          success: false,
          message: "Counselor already exists with this email",
        });
      }

      // Generate secure invitation token
      const inviteToken = crypto.randomBytes(32).toString("hex");
      const tokenExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

      // Create counselor with pending status and invitation token
      const counselor = new Counselor({
        email: SecurityUtils.sanitizeUserInput(email),
        firstName: SecurityUtils.sanitizeUserInput(firstName),
        lastName: SecurityUtils.sanitizeUserInput(lastName),
        role: "counselor",
        verificationStatus: "invited",
        isVerified: false,
        inviteToken,
        inviteTokenExpiry: tokenExpiry,
        invitedBy: admin._id,
        invitedAt: new Date(),
      });

      await counselor.save();

      // Send invitation email to counselor
      try {
        await notificationService.sendCounselorInvitation(
          counselor,
          inviteToken
        );
        logger.info(`Invitation email sent to counselor: ${counselor.email}`);
      } catch (emailError) {
        logger.error(
          `Failed to send invitation email to ${counselor.email}:`,
          emailError
        );
        // this will remove the counselor record if email fails
        await Counselor.deleteOne({ _id: counselor._id });
        return res.status(500).json({
          success: false,
          message: "Failed to send invitation email. Please try again.",
        });
      }

      logger.info(
        `Counselor ${counselor.email} invited by admin ${admin.email}`
      );

      res.status(201).json({
        success: true,
        message:
          "Invitation sent successfully. Counselor will receive an email to complete registration.",
        data: {
          counselor: {
            id: counselor._id,
            email: counselor.email,
            firstName: counselor.firstName,
            lastName: counselor.lastName,
            specialization: counselor.specialization,
            experience: counselor.experience,
            verificationStatus: counselor.verificationStatus,
            invitedAt: counselor.invitedAt,
          },
        },
      });
    } catch (error) {
      logger.error("Invite counselor error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to invite counselor. Please try again.",
        error: error.message,
      });
    }
  },

  // counselor completes registration using invitation token
  completeCounselorRegistration: async (req, res) => {
    try {
      const { token } = req.params;
      const {
        username,
        password,
        phoneNumber,
        licenseNumber,
        specialization,
        experience,
        bio,
      } = req.body;

      // Find counselor by invite token
      const counselor = await Counselor.findOne({
        inviteToken: token,
        inviteTokenExpiry: { $gt: Date.now() },
        verificationStatus: "invited",
      });

      if (!counselor) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired invitation link",
        });
      }

      const existingUsername = await Counselor.findOne({ username });
      if (existingUsername) {
        return res.status(400).json({
          success: false,
          message: "Username already taken",
        });
      }

      const existingLicense = await Counselor.findOne({ licenseNumber });
      if (existingLicense) {
        return res.status(400).json({
          success: false,
          message: "License number already registered",
        });
      }

      if (!SecurityUtils.isStrongPassword(password)) {
        return res.status(400).json({
          success: false,
          message:
            "Password must be at least 6 characters long and contain uppercase, lowercase letters and numbers",
        });
      }

      // Update counselor with all details
      counselor.username = SecurityUtils.sanitizeUserInput(username);
      counselor.password = password;
      counselor.phoneNumber = SecurityUtils.sanitizeUserInput(phoneNumber);
      counselor.licenseNumber = SecurityUtils.sanitizeUserInput(licenseNumber);
      counselor.specialization = specialization;
      counselor.experience = experience;
      counselor.bio = SecurityUtils.sanitizeUserInput(bio || "");
      counselor.verificationStatus = "approved";
      counselor.isVerified = true;
      counselor.isActive = true;
      counselor.adminApprovedBy = counselor.invitedBy;
      counselor.adminApprovedAt = new Date();
      counselor.inviteToken = undefined;
      counselor.inviteTokenExpiry = undefined;

      await counselor.save();

      // Update admin metrics
      const admin = await require("../models/admin").findById(
        counselor.invitedBy
      );
      if (admin) {
        admin.counselorsApproved += 1;
        await admin.save();
      }

      // Send welcome email
      try {
        await notificationService.sendCounselorApprovalNotification(
          counselor,
          admin
        );
        logger.info(`Welcome email sent to counselor: ${counselor.email}`);
      } catch (emailError) {
        logger.error(
          `Failed to send welcome email to ${counselor.email}:`,
          emailError
        );
      }

      logger.info(
        `Counselor ${counselor.email} approved by admin ${admin.email}`
      );

      res.json({
        success: true,
        message:
          "Registration completed successfully. You can now log in with your credentials.",
        data: {
          counselor: {
            id: counselor._id,
            email: counselor.email,
            username: counselor.username,
            firstName: counselor.firstName,
            lastName: counselor.lastName,
            phoneNumber: counselor.phoneNumber,
            licenseNumber: counselor.licenseNumber,
            specialization: counselor.specialization,
            experience: counselor.experience,
            verificationStatus: counselor.verificationStatus,
          },
        },
      });
    } catch (error) {
      logger.error("Complete counselor registration error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to complete registration",
        error: error.message,
      });
    }
  },

  // Get all pending counselor applications
  getPendingCounselors: async (req, res) => {
    try {
      const pendingCounselors = await Counselor.find({
        verificationStatus: "pending",
      }).select("-password");

      res.json({
        success: true,
        message: "Pending counselors retrieved successfully",
        data: {
          counselors: pendingCounselors,
          count: pendingCounselors.length,
        },
      });
    } catch (error) {
      logger.error("Get pending counselors error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve pending counselors",
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
          message: "Counselor not found",
        });
      }

      if (counselor.verificationStatus !== "pending") {
        return res.status(400).json({
          success: false,
          message: "Counselor application is not pending",
        });
      }

      // Update counselor status
      counselor.verificationStatus = "approved";
      counselor.isVerified = true;
      counselor.adminApprovedBy = admin._id;
      counselor.adminApprovedAt = new Date();

      await counselor.save();

      // Update admin metrics
      admin.counselorsApproved += 1;
      await admin.save();

      // Send approval email to counselor
      try {
        await notificationService.sendCounselorApprovalNotification(
          counselor,
          admin
        );
        logger.info(`Approval email sent to counselor: ${counselor.email}`);
      } catch (emailError) {
        logger.error(
          `Failed to send approval email to ${counselor.email}:`,
          emailError
        );
      }

      logger.info(
        `Counselor ${counselor.email} approved by admin ${admin.email}`
      );

      res.json({
        success: true,
        message:
          "Counselor approved successfully. Notification email sent to counselor.",
        data: {
          counselor: {
            id: counselor._id,
            email: counselor.email,
            username: counselor.username,
            verificationStatus: counselor.verificationStatus,
            approvedAt: counselor.adminApprovedAt,
          },
        },
      });
    } catch (error) {
      logger.error("Approve counselor error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to approve counselor",
        error: error.message,
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
          message: "Counselor not found",
        });
      }

      if (counselor.verificationStatus !== "pending") {
        return res.status(400).json({
          success: false,
          message: "Counselor application is not pending",
        });
      }

      // Update counselor status
      counselor.verificationStatus = "rejected";
      counselor.rejectionReason =
        rejectionReason || "Application rejected by admin";
      counselor.adminApprovedBy = admin._id;
      counselor.adminApprovedAt = new Date();

      await counselor.save();

      // Update admin metrics
      admin.counselorsRejected += 1;
      await admin.save();

      // Send rejection email to counselor
      try {
        await notificationService.sendCounselorRejectionNotification(
          counselor,
          rejectionReason,
          admin
        );
        logger.info(`Rejection email sent to counselor: ${counselor.email}`);
      } catch (emailError) {
        logger.error(
          `Failed to send rejection email to ${counselor.email}:`,
          emailError
        );
      }

      logger.info(
        `Counselor ${counselor.email} rejected by admin ${admin.email}. Reason: ${rejectionReason}`
      );

      res.json({
        success: true,
        message:
          "Counselor application rejected. Notification email sent to counselor.",
        data: {
          counselor: {
            id: counselor._id,
            email: counselor.email,
            verificationStatus: counselor.verificationStatus,
            rejectionReason: counselor.rejectionReason,
          },
        },
      });
    } catch (error) {
      logger.error("Reject counselor error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to reject counselor",
      });
    }
  },

  // Get all counselors for admin management
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
        .select("-password")
        .populate("adminApprovedBy", "username email")
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        message: "Counselors retrieved successfully",
        data: {
          counselors,
          count: counselors.length,
        },
      });
    } catch (error) {
      logger.error("Get all counselors error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve counselors",
      });
    }
  },

  // Get all users with optional filtering
  getAllUsers: async (req, res) => {
    try {
      const { role, isActive, search } = req.query;

      const filter = {};
      if (role) {
        filter.role = SecurityUtils.sanitizeUserInput(role);
      }
      if (typeof isActive !== "undefined") {
        filter.isActive = isActive === "true" || isActive === true;
      }
      if (search) {
        const sanitizedSearch = SecurityUtils.sanitizeUserInput(search);
        if (sanitizedSearch) {
          const searchRegex = new RegExp(
            sanitizedSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            "i"
          );
          filter.$or = [{ email: searchRegex }, { username: searchRegex }];
        }
      }

      const users = await User.find(filter)
        .select("-password")
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        message: "Users retrieved successfully",
        data: {
          users,
          count: users.length,
        },
      });
    } catch (error) {
      logger.error("Get all users error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve users",
      });
    }
  },

  // Get single user by ID
  getUserById: async (req, res) => {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId).select("-password");
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.json({
        success: true,
        message: "User retrieved successfully",
        data: { user },
      });
    } catch (error) {
      logger.error("Get user by id error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve user",
      });
    }
  },

  // Create new user
  createUser: async (req, res) => {
    try {
      const {
        email,
        password,
        username,
        role = "user",
        isActive = true,
      } = req.body;

      if (!email || !password || !username) {
        return res.status(400).json({
          success: false,
          message: "Email, username and password are required",
        });
      }

      if (!SecurityUtils.validateEmail(email)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email address",
        });
      }

      if (!SecurityUtils.isStrongPassword(password)) {
        return res.status(400).json({
          success: false,
          message:
            "Password must be at least 6 characters long and contain uppercase, lowercase letters and numbers",
        });
      }

      const sanitizedEmail =
        SecurityUtils.sanitizeUserInput(email).toLowerCase();
      const sanitizedUsername = SecurityUtils.sanitizeUserInput(username);
      const sanitizedRole = SecurityUtils.sanitizeUserInput(role);
      const allowedRoles = ["user", "counselor", "admin"];

      if (!allowedRoles.includes(sanitizedRole)) {
        return res.status(400).json({
          success: false,
          message: "Invalid role specified",
        });
      }

      const existingEmail = await User.findOne({ email: sanitizedEmail });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: "Email already exists",
        });
      }

      const existingUsername = await User.findOne({
        username: sanitizedUsername,
      });
      if (existingUsername) {
        return res.status(400).json({
          success: false,
          message: "Username already exists",
        });
      }

      const user = new User({
        email: sanitizedEmail,
        password,
        username: sanitizedUsername,
        role: sanitizedRole,
        isActive: isActive === true || isActive === "true",
      });

      await user.save();

      const userResponse = user.toObject();
      delete userResponse.password;

      logger.info(`User ${user.email} created by admin ${req.admin.email}`);

      res.status(201).json({
        success: true,
        message: "User created successfully",
        data: { user: userResponse },
      });
    } catch (error) {
      logger.error("Create user error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create user",
      });
    }
  },

  // Update existing user
  updateUser: async (req, res) => {
    try {
      const { userId } = req.params;
      const { email, password, username, role, isActive } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      if (email) {
        if (!SecurityUtils.validateEmail(email)) {
          return res.status(400).json({
            success: false,
            message: "Invalid email address",
          });
        }

        const sanitizedEmail =
          SecurityUtils.sanitizeUserInput(email).toLowerCase();
        const emailExists = await User.findOne({
          email: sanitizedEmail,
          _id: { $ne: userId },
        });
        if (emailExists) {
          return res.status(400).json({
            success: false,
            message: "Email already in use",
          });
        }
        user.email = sanitizedEmail;
      }

      if (username) {
        const sanitizedUsername = SecurityUtils.sanitizeUserInput(username);
        const usernameExists = await User.findOne({
          username: sanitizedUsername,
          _id: { $ne: userId },
        });
        if (usernameExists) {
          return res.status(400).json({
            success: false,
            message: "Username already in use",
          });
        }
        user.username = sanitizedUsername;
      }

      if (role) {
        const sanitizedRole = SecurityUtils.sanitizeUserInput(role);
        const allowedRoles = ["user", "counselor", "admin"];
        if (!allowedRoles.includes(sanitizedRole)) {
          return res.status(400).json({
            success: false,
            message: "Invalid role specified",
          });
        }
        user.role = sanitizedRole;
      }

      if (typeof isActive !== "undefined") {
        user.isActive = isActive === true || isActive === "true";
      }

      if (password) {
        if (!SecurityUtils.isStrongPassword(password)) {
          return res.status(400).json({
            success: false,
            message:
              "Password must be at least 6 characters long and contain uppercase, lowercase letters and numbers",
          });
        }
        user.password = password;
      }

      await user.save();

      const userResponse = user.toObject();
      delete userResponse.password;

      logger.info(`User ${user.email} updated by admin ${req.admin.email}`);

      res.json({
        success: true,
        message: "User updated successfully",
        data: { user: userResponse },
      });
    } catch (error) {
      logger.error("Update user error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update user",
      });
    }
  },

  // Delete user
  deleteUser: async (req, res) => {
    try {
      const { userId } = req.params;
      const admin = req.admin;

      if (
        typeof admin.hasPermission === "function" &&
        !admin.hasPermission("delete")
      ) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to delete users",
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      await User.deleteOne({ _id: userId });

      logger.info(`User ${user.email} deleted by admin ${admin.email}`);

      res.json({
        success: true,
        message: "User deleted successfully",
      });
    } catch (error) {
      logger.error("Delete user error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete user",
      });
    }
  },

  // Get platform statistics
  getPlatformStats: async (req, res) => {
    try {
      const totalUsers = await User.countDocuments({ isActive: true });
      const totalCounselors = await Counselor.countDocuments({
        isActive: true,
      });
      const verifiedCounselors = await Counselor.countDocuments({
        isVerified: true,
        isActive: true,
      });
      const pendingCounselors = await Counselor.countDocuments({
        verificationStatus: "pending",
      });
      const rejectedCounselors = await Counselor.countDocuments({
        verificationStatus: "rejected",
      });

      // Get counselor specializations distribution
      const specializationStats = await Counselor.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: "$specialization", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);

      // Get recent activity the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentRegistrations = await User.countDocuments({
        createdAt: { $gte: thirtyDaysAgo },
      });

      const recentCounselorApplications = await Counselor.countDocuments({
        createdAt: { $gte: thirtyDaysAgo },
      });

      const stats = {
        totalUsers,
        totalCounselors,
        verifiedCounselors,
        pendingCounselors,
        rejectedCounselors,
        verificationRate:
          totalCounselors > 0
            ? ((verifiedCounselors / totalCounselors) * 100).toFixed(2)
            : 0,
        specializationStats,
        recentActivity: {
          userRegistrations: recentRegistrations,
          counselorApplications: recentCounselorApplications,
        },
      };

      res.json({
        success: true,
        message: "Platform statistics retrieved",
        data: { stats },
      });
    } catch (error) {
      logger.error("Get platform stats error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve platform statistics",
      });
    }
  },

  // Get admin dashboard overview
  getDashboardOverview: async (req, res) => {
    try {
      const admin = req.admin;

      // Get pending applications
      const pendingApplications = await Counselor.find({
        verificationStatus: "pending",
      })
        .select(
          "email username firstName lastName specialization experience createdAt"
        )
        .sort({ createdAt: -1 })
        .limit(10);

      // Get recently approved counselors
      const recentlyApproved = await Counselor.find({
        verificationStatus: "approved",
        adminApprovedAt: { $exists: true },
      })
        .select(
          "email username firstName lastName specialization adminApprovedAt"
        )
        .sort({ adminApprovedAt: -1 })
        .limit(5);

      // Get admin activity summary
      const adminStats = {
        counselorsApproved: admin.counselorsApproved,
        counselorsRejected: admin.counselorsRejected,
        lastActivity: admin.lastActivity,
      };

      res.json({
        success: true,
        message: "Dashboard overview retrieved",
        data: {
          pendingApplications,
          recentlyApproved,
          adminStats,
          totalPending: pendingApplications.length,
        },
      });
    } catch (error) {
      logger.error("Get dashboard overview error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve dashboard overview",
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
          message: "Counselor not found",
        });
      }

      counselor.isActive = false;
      await counselor.save();

      logger.info(
        `Counselor ${counselor.email} deactivated by admin ${admin.email}`
      );

      res.json({
        success: true,
        message: "Counselor deactivated successfully",
        data: {
          counselor: {
            id: counselor._id,
            email: counselor.email,
            isActive: counselor.isActive,
          },
        },
      });
    } catch (error) {
      logger.error("Deactivate counselor error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to deactivate counselor",
      });
    }
  },

  // Delete counselor
  deleteCounselor: async (req, res) => {
    try {
      const { counselorId } = req.params;
      const admin = req.admin;

      if (!admin.hasPermission("delete")) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to delete counselors",
        });
      }

      const counselor = await Counselor.findById(counselorId);
      if (!counselor) {
        return res.status(404).json({
          success: false,
          message: "Counselor not found",
        });
      }

      await Counselor.deleteOne({ _id: counselorId });

      logger.info(
        `Counselor ${counselor.email} deleted by admin ${admin.email}`
      );

      res.json({
        success: true,
        message: "Counselor deleted successfully",
      });
    } catch (error) {
      logger.error("Delete counselor error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete counselor",
      });
    }
  },

  // Get 3-month analytics summary 
  getThreeMonthSummary: async (req, res) => {
    try {
      const Appointment = require("../models/appointment");

      // Last 3 months
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      // Users data
      const totalUsers = await User.countDocuments();
      const newUsers = await User.countDocuments({
        createdAt: { $gte: threeMonthsAgo },
      });
      const activeUsers = await User.countDocuments({ isActive: true });

      // Counselors data
      const totalCounselors = await Counselor.countDocuments();
      const newCounselors = await Counselor.countDocuments({
        createdAt: { $gte: threeMonthsAgo },
      });
      const approvedCounselors = await Counselor.countDocuments({
        verificationStatus: "approved",
        isActive: true,
      });
      const pendingCounselors = await Counselor.countDocuments({
        verificationStatus: "pending",
      });

      // Appointments data
      const totalAppointments = await Appointment.countDocuments();
      const newAppointments = await Appointment.countDocuments({
        createdAt: { $gte: threeMonthsAgo },
      });
      const completedAppointments = await Appointment.countDocuments({
        status: "completed",
      });
      const upcomingAppointments = await Appointment.countDocuments({
        status: { $in: ["pending", "confirmed"] },
        appointmentDate: { $gte: new Date() },
      });

      // Monthly breakdown for the last 3 months
      const monthlyUsers = await User.aggregate([
        { $match: { createdAt: { $gte: threeMonthsAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      const monthlyCounselors = await Counselor.aggregate([
        { $match: { createdAt: { $gte: threeMonthsAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      const monthlyAppointments = await Appointment.aggregate([
        { $match: { createdAt: { $gte: threeMonthsAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            total: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      res.json({
        success: true,
        message: "3-month analytics summary retrieved successfully",
        data: {
          period: "Last 3 Months",
          users: {
            total: totalUsers,
            new: newUsers,
            active: activeUsers,
            monthlyData: monthlyUsers,
          },
          counselors: {
            total: totalCounselors,
            new: newCounselors,
            approved: approvedCounselors,
            pending: pendingCounselors,
            monthlyData: monthlyCounselors,
          },
          appointments: {
            total: totalAppointments,
            new: newAppointments,
            completed: completedAppointments,
            upcoming: upcomingAppointments,
            completionRate:
              totalAppointments > 0
                ? ((completedAppointments / totalAppointments) * 100).toFixed(1)
                : 0,
            monthlyData: monthlyAppointments,
          },
        },
      });
    } catch (error) {
      logger.error("Get 3-month summary error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve 3-month summary",
      });
    }
  },
};

module.exports = adminController;
