const jwt = require('jsonwebtoken');
const User = require('../models/user');
const Admin = require('../models/admin');
const GuestSession = require('../models/guestSession');
const SecurityUtils = require('../utils/security.js');
const logger = require('../utils/logger');

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

  // Login user
  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      // Find user
      const user = await User.findOne({
        email: SecurityUtils.sanitizeUserInput(email),
        isActive: true
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Check if account is locked
      if (user.isLocked()) {
        return res.status(423).json({
          success: false,
          message: 'Account temporarily locked due to too many failed attempts'
        });
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);

      if (!isPasswordValid) {
        // Increment login attempts
        user.loginAttempts += 1;

        // Lock account after 5 failed attempts for 30 minutes
        if (user.loginAttempts >= 5) {
          user.lockUntil = Date.now() + 30 * 60 * 1000; // 30 minutes
        }

        await user.save();

        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Reset login attempts on successful login
      user.loginAttempts = 0;
      user.lockUntil = undefined;
      user.lastLogin = new Date();
      await user.save();

      // Generate token
      const token = generateToken(user._id);

      logger.info(`User logged in: ${user.email}`);

      res.json({
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

  // Admin login
  adminLogin: async (req, res) => {
    try {
      const { email, password } = req.body;

      // Find admin
      const admin = await Admin.findOne({
        email: SecurityUtils.sanitizeUserInput(email),
        isActive: true
      });

      if (!admin) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Check if account is locked
      if (admin.isLocked()) {
        return res.status(423).json({
          success: false,
          message: 'Account temporarily locked due to too many failed attempts'
        });
      }

      // Verify password
      const isPasswordValid = await admin.comparePassword(password);

      if (!isPasswordValid) {
        // Increment login attempts
        admin.loginAttempts += 1;

        // Lock account after 5 failed attempts for 30 minutes
        if (admin.loginAttempts >= 5) {
          admin.lockUntil = Date.now() + 30 * 60 * 1000; // 30 minutes
        }

        await admin.save();

        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Reset login attempts on successful login
      admin.loginAttempts = 0;
      admin.lockUntil = undefined;
      admin.lastLogin = new Date();
      admin.lastActivity = new Date();
      await admin.save();

      // Generate token
      const token = generateToken(admin._id);

      logger.info(`Admin logged in: ${admin.email}`);

      res.json({
        success: true,
        message: 'Admin login successful',
        data: {
          token,
          admin: {
            id: admin._id,
            email: admin.email,
            username: admin.username,
            firstName: admin.firstName,
            lastName: admin.lastName,
            role: admin.role,
            permissions: admin.permissions,
            isSuperAdmin: admin.isSuperAdmin
          }
        }
      });

    } catch (error) {
      logger.error('Admin login error:', error);
      res.status(500).json({
        success: false,
        message: 'Admin login failed'
      });
    }
  }
};

module.exports = authController;