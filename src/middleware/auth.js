const jwt = require('jsonwebtoken');
const User = require('../models/user');
const Admin = require('../models/admin');
const logger = require('../utils/logger');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({
      _id: decoded.userId,
      isActive: true
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token is valid but user not found.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Authentication failed.'
    });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findOne({
        _id: decoded.userId,
        isActive: true
      });

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
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Try to find admin first
    const admin = await Admin.findOne({
      _id: decoded.userId,
      isActive: true
    });

    if (admin) {
      req.admin = admin;
      return next();
    }

    // If not admin, check if it's a user with admin role
    const user = await User.findOne({
      _id: decoded.userId,
      isActive: true,
      role: 'admin'
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Admin access denied. Invalid credentials.'
      });
    }

    req.admin = user;
    next();
  } catch (error) {
    logger.error('Admin authentication error:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Admin authentication failed.'
    });
  }
};

module.exports = { auth, optionalAuth, adminAuth };