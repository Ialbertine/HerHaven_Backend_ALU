const jwt = require('jsonwebtoken');
const User = require('../models/user');
const Admin = require('../models/admin');
const GuestSession = require('../models/guestSession');
const SecurityUtils = require('../utils/security.js');
const logger = require('../utils/logger');
const Counselor = require('../models/counselor');

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

const authController = {
  // Register new user
  register: async (req, res) => {
    try {
      const { email, password, username } = req.body;

      // Check if user already exists by email
      const existingUserByEmail = await User.findOne({ email });
      if (existingUserByEmail) {
        return res.status(400).json({
          success: false,
          message: 'User already exists with this email'
        });
      }

      // Check if username already exists
      const existingUserByUsername = await User.findOne({ username });
      if (existingUserByUsername) {
        return res.status(400).json({
          success: false,
          message: 'Username already taken'
        });
      }

      // Validate password strength
      if (!SecurityUtils.isStrongPassword(password)) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long and contain uppercase, lowercase letters and numbers'
        });
      }

      // Create new user
      const user = new User({
        email: SecurityUtils.sanitizeUserInput(email),
        password,
        username: SecurityUtils.sanitizeUserInput(username),
        role: 'user'
      });

      await user.save();

      // Generate token
      const token = generateToken(user._id);

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      logger.info(`New user registered: ${user.email} with username: ${user.username}`);

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          token,
          user: {
            id: user._id,
            email: user.email,
            username: user.username,
            role: user.role
          }
        }
      });

    } catch (error) {
      logger.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Registration failed'
      });
    }
  },

  // Login user and admin
  login: async (req, res) => {
    try {
      const { email, password } = req.body;
      const sanitizedEmail = SecurityUtils.sanitizeUserInput(email);

      // 1. Try to find an active user
      const user = await User.findOne({
        email: sanitizedEmail,
        isActive: true
      });

      if (user) {
        if (user.isLocked()) {
          return res.status(423).json({
            success: false,
            message: 'Account temporarily locked due to too many failed attempts'
          });
        }

        const isPasswordValid = await user.comparePassword(password);

        if (!isPasswordValid) {
          user.loginAttempts += 1;
          if (user.loginAttempts >= 5) {
            user.lockUntil = Date.now() + 30 * 60 * 1000; 
          }
          await user.save();
          return res.status(401).json({
            success: false,
            message: 'Invalid email or password'
          });
        }

        user.loginAttempts = 0;
        user.lockUntil = undefined;
        user.lastLogin = new Date();
        await user.save();

        const token = generateToken(user._id);
        logger.info(`User logged in: ${user.email}`);

        return res.json({
          success: true,
          message: 'Login successful',
          data: {
            token,
            user: {
              id: user._id,
              email: user.email,
              username: user.username,
              role: user.role
            }
          }
        });
      }

      // for admin login
      const admin = await Admin.findOne({
        email: sanitizedEmail,
        isActive: true
      });

      if (admin) {
        if (admin.isLocked()) {
          return res.status(423).json({
            success: false,
            message: 'Account temporarily locked due to too many failed attempts'
          });
        }

        const isPasswordValid = await admin.comparePassword(password);

        if (!isPasswordValid) {
          admin.loginAttempts += 1;
          if (admin.loginAttempts >= 5) {
            admin.lockUntil = Date.now() + 30 * 60 * 1000;
          }
          await admin.save();
          return res.status(401).json({
            success: false,
            message: 'Invalid email or password'
          });
        }

        admin.loginAttempts = 0;
        admin.lockUntil = undefined;
        admin.lastLogin = new Date();
        admin.lastActivity = new Date();
        await admin.save();

        const token = generateToken(admin._id);
        logger.info(`Admin logged in: ${admin.email}`);

        return res.json({
          success: true,
          message: 'Admin login successful',
          data: {
            token,
            user: { 
              id: admin._id,
              email: admin.email,
              username: admin.username,
              firstName: admin.firstName,
              lastName: admin.lastName,
              role: admin.role,
              isSuperAdmin: admin.isSuperAdmin
            }
          }
        });
      }

      // counselor login who have been approved
      const counselor = await Counselor.findOne({
        email: sanitizedEmail,
        isActive: true,
        isVerified: true
      });

      if (counselor) {
        if (counselor.isLocked()) {
          return res.status(423).json({
            success: false,
            message: 'Account temporarily locked due to too many failed attempts'
          });
        }

        const isPasswordValid = await counselor.comparePassword(password);

        if (!isPasswordValid) {
          counselor.loginAttempts += 1;
          if (counselor.loginAttempts >= 5) {
            counselor.lockUntil = Date.now() + 30 * 60 * 1000;
          }
          await counselor.save();
          return res.status(401).json({
            success: false,
            message: 'Invalid email or password'
          });
        }

        counselor.loginAttempts = 0;
        counselor.lockUntil = undefined;
        counselor.lastLogin = new Date();
        await counselor.save();

        const token = generateToken(counselor._id);
        logger.info(`Counselor logged in: ${counselor.email}`);

        return res.json({
          success: true,
          message: 'Counselor login successful',
          data: {
            token,
            user: {
              id: counselor._id,
              email: counselor.email,
              username: counselor.username,
              firstName: counselor.firstName,
              lastName: counselor.lastName,
              role: counselor.role,
              specialization: counselor.specialization
            }
          }
        });
      }

      // No user or admin found with that email
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });

    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Login failed'
      });
    }
  },

  // Continue as guest
  continueAsGuest: async (req, res) => {
    try {
      const { userAgent, ipAddress } = req.body;

      // Generate unique session ID
      const sessionId = SecurityUtils.generateGuestSessionId();

      // Create guest session
      const guestSession = new GuestSession({
        sessionId,
        ipAddress,
        userAgent: SecurityUtils.sanitizeUserInput(userAgent || '')
      });

      await guestSession.save();

      logger.info(`New guest session created: ${sessionId}`);

      res.json({
        success: true,
        message: 'Guest session created successfully',
        data: {
          sessionId,
          accessType: 'guest'
        }
      });

    } catch (error) {
      logger.error('Guest access error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create guest session'
      });
    }
  },

  // Validate guest session
  validateGuestSession: async (req, res) => {
    try {
      const { sessionId } = req.body;

      const session = await GuestSession.findOne({
        sessionId,
        isActive: true
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Invalid or expired guest session'
        });
      }

      // Update last activity
      session.lastActivity = new Date();
      await session.save();

      res.json({
        success: true,
        message: 'Guest session is valid',
        data: { sessionId }
      });

    } catch (error) {
      logger.error('Guest session validation error:', error);
      res.status(500).json({
        success: false,
        message: 'Session validation failed'
      });
    }
  },
};

module.exports = authController;