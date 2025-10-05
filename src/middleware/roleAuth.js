const Counselor = require('../models/counselor');
const Admin = require('../models/admin');
const logger = require('../utils/logger');

// Role-based access control middleware
const requireRole = (roles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const userRole = req.user.role;

      // Check if user role is in allowed roles
      if (!roles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
      }

      // For counselor role, check if counselor is verified
      if (userRole === 'counselor') {
        const counselor = await Counselor.findOne({
          email: req.user.email,
          isVerified: true,
          isActive: true
        });

        if (!counselor) {
          return res.status(403).json({
            success: false,
            message: 'Counselor account not verified or inactive'
          });
        }

        req.counselor = counselor;
      }

      // For admin role, check if admin is active
      if (userRole === 'admin') {
        const admin = await Admin.findOne({
          email: req.user.email,
          isActive: true
        });

        if (!admin) {
          return res.status(403).json({
            success: false,
            message: 'Admin account not found or inactive'
          });
        }

        req.admin = admin;
      }

      next();
    } catch (error) {
      logger.error('Role authorization error:', error);
      res.status(500).json({
        success: false,
        message: 'Authorization failed'
      });
    }
  };
};

// Specific role middlewares
const requireUser = requireRole(['user']);
const requireCounselor = requireRole(['counselor']);
const requireAdmin = requireRole(['admin']);
const requireCounselorOrAdmin = requireRole(['counselor', 'admin']);
const requireAnyRole = requireRole(['user', 'counselor', 'admin']);

// Permission-based middleware for admins
const requirePermission = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.admin) {
        return res.status(401).json({
          success: false,
          message: 'Admin authentication required'
        });
      }

      if (!req.admin.hasPermission(permission)) {
        return res.status(403).json({
          success: false,
          message: `Permission '${permission}' required`
        });
      }

      next();
    } catch (error) {
      logger.error('Permission check error:', error);
      res.status(500).json({
        success: false,
        message: 'Permission check failed'
      });
    }
  };
};

// Specific permission middlewares
const requireCounselorApproval = requirePermission('approve_counselors');
const requireUserManagement = requirePermission('manage_users');
const requireAnalytics = requirePermission('view_analytics');
const requireContentManagement = requirePermission('manage_content');
const requireSystemSettings = requirePermission('system_settings');

module.exports = {
  requireRole,
  requireUser,
  requireCounselor,
  requireAdmin,
  requireCounselorOrAdmin,
  requireAnyRole,
  requirePermission,
  requireCounselorApproval,
  requireUserManagement,
  requireAnalytics,
  requireContentManagement,
  requireSystemSettings
};
