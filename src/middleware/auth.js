const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Admin = require("../models/admin");
const logger = require("../utils/logger");
const Counselor = require("../models/counselor");

const auth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Try to find user first
    let user = await User.findOne({
      _id: decoded.userId,
      isActive: true,
    });

    // If not found in User, try Admin
    if (!user) {
      user = await Admin.findOne({
        _id: decoded.userId,
        isActive: true,
      });
    }

    // for checking counselor
    if (!user) {
      user = await Counselor.findOne({
        _id: decoded.userId,
        isActive: true,
        isVerified: true,
      });
    }

    if (user) {
      user = user.toObject(); 
      user.role = "counselor"; 
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Token is valid but user/admin not found.",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error("Authentication error:", error);

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token.",
      });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired.",
      });
    }

    res.status(500).json({
      success: false,
      message: "Authentication failed.",
    });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Try User first
      let user = await User.findOne({
        _id: decoded.userId,
        isActive: true,
      });

      // If not found, try Admin
      if (!user) {
        user = await Admin.findOne({
          _id: decoded.userId,
          isActive: true,
        });
      }

      // for checking counselor
      if (!user) {
        user = await Counselor.findOne({
          _id: decoded.userId,
          isActive: true,
          isVerified: true,
        });
      }

      if (user) {
        user = user.toObject();
        user.role = "counselor";
      }

      if (user) {
        req.user = user;
      }
    }

    next();
  } catch {
    next();
  }
};

const adminAuth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Only check Admin collection for admin routes
    const admin = await Admin.findOne({
      _id: decoded.userId,
      isActive: true,
    });

    if (!admin) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You don't have permission to perform this action.",
      });
    }

    req.user = admin;
    req.admin = admin; 
    next();
  } catch (error) {
    logger.error("Admin authentication error:", error);

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token.",
      });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired.",
      });
    }

    res.status(500).json({
      success: false,
      message: "Admin authentication failed.",
    });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    // Handle Admin role property
    const userRole =
      req.user.role || (req.user.isSuperAdmin ? "super_admin" : null);

    if (!userRole || !roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Insufficient permissions for this action.",
      });
    }

    next();
  };
};

const superAdminAuth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const admin = await Admin.findOne({
      _id: decoded.userId,
      isActive: true,
      isSuperAdmin: true,
    });

    if (!admin) {
      return res.status(403).json({
        success: false,
        message: "Super admin access denied. Insufficient permissions.",
      });
    }

    req.user = admin;
    req.admin = admin;
    next();
  } catch (error) {
    logger.error("Super admin authentication error:", error);

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token.",
      });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired.",
      });
    }

    res.status(500).json({
      success: false,
      message: "Super admin authentication failed.",
    });
  }
};

module.exports = {
  auth,
  optionalAuth,
  adminAuth,
  requireRole,
  superAdminAuth,
};
