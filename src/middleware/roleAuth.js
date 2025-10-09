const Counselor = require('../models/counselor');
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

      // Determine user role and check if it's from Admin collection
      const userRole = req.user.role;
      // If role is 'admin' or 'super_admin', this is from Admin collection
      if (userRole === 'admin' || userRole === 'super_admin' || req.user.isSuperAdmin) {
        if (!req.admin) {
          req.admin = req.user;
        }
      }

      // Check if user role is in allowed roles
      if (!roles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions',
          error: { userRole, requiredRoles: roles }
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
const requireAdmin = requireRole(['admin', 'super_admin']);
const requireCounselorOrAdmin = requireRole(['counselor', 'admin', 'super_admin']);
const requireAnyRole = requireRole(['user', 'counselor', 'admin', 'super_admin']);

// Permission-based middleware for admins
const requirePermission = (permission) => {
  return async (req, res, next) => {
    try {
      // Check if req.admin exists, if not, check if req.user is an Admin
      let admin = req.admin;
      
      if (!admin && req.user) {
        // Check if req.user is actually an Admin
        const userRole = req.user.role;
        if (userRole === 'admin' || userRole === 'super_admin' || req.user.isSuperAdmin) {
          admin = req.user;
          req.admin = admin; 
        }
      }

      if (!admin) {
        return res.status(401).json({
          success: false,
          message: 'Admin authentication required'
        });
      }

      if (!admin.hasPermission(permission)) {
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