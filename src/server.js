require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const connectDB = require("./config/db");
const errorHandler = require("./middleware/errorHandler");
const logger = require("./utils/logger");

// Route imports
const authRoutes = require("./routes/authRoutes");
const safetyRoutes = require("./routes/safetyRoutes");
const counselorRoutes = require("./routes/counselorRoutes");
const adminRoutes = require("./routes/adminRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const communityRoutes = require("./routes/communityRoutes");

// Initialize express app
const app = express();

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// Connect to database
connectDB();

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// CORS configuration
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://ialbertine-herhaven.netlify.app",
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        logger.warn(`CORS blocked origin: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Content-Range", "X-Content-Range"],
    maxAge: 600,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
  },
});
app.use((req, res, next) => {
   if (req.path === "/api/health" || req.path === "/api/email-health") {
    return next();
  }
  limiter(req, res, next);
});


// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  morgan("combined", {
    stream: { write: (message) => logger.info(message.trim()) },
  })
);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/safety", safetyRoutes);
app.use("/api/counselor", counselorRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/community", communityRoutes);


// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "HerHaven API is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// Simple email health check endpoint
app.get("/api/email-health", async (req, res) => {
  try {
    const emailService = require("./services/emailService");
    
    if (!emailService.transporter) {
      return res.status(503).json({ 
        success: false,
        message: 'Email service not initialized' 
      });
    }

    // Test connection
    await emailService.transporter.verify();
    
    res.json({
      success: true,
      message: 'Email service is working correctly',
      config: {
        host: process.env.SMTP_HOST,
        user: process.env.SMTP_USER,
      }
    });
    
  } catch (error) {
    logger.error('Email health check failed:', error);
    res.status(503).json({
      success: false,
      message: 'Email service test failed',
      error: error.message
    });
  }
});

app.post("/api/test-email", async (req, res) => {
  try {
    const { toEmail } = req.body;
    
    // CHANGE 2: Validate email input
    if (!toEmail) {
      return res.status(400).json({
        success: false,
        message: 'Please provide toEmail in request body'
      });
    }

    const emailService = require("./services/emailService");
    
    // CHANGE 3: Check if email service is initialized
    if (!emailService.transporter) {
      logger.error('Email transporter not initialized');
      return res.status(503).json({ 
        success: false,
        message: 'Email service not initialized',
        details: 'Check server logs for initialization errors'
      });
    }

    // CHANGE 4: Log the attempt
    logger.info(`Testing email send to: ${toEmail}`);

    // CHANGE 5: Send a simple test email
    const result = await emailService.sendEmail(
      toEmail,
      "Test Email from HerHaven",
      `
        <h2>Test Email</h2>
        <p>This is a test email from your HerHaven API deployed on Render.</p>
        <p>If you received this, your email service is working correctly!</p>
        <p>Timestamp: ${new Date().toISOString()}</p>
      `,
      "This is a test email from HerHaven API"
    );

    // CHANGE 6: Return detailed result
    if (result.success) {
      logger.info('Test email sent successfully');
      res.json({
        success: true,
        message: 'Test email sent successfully!',
        messageId: result.messageId,
        sentTo: toEmail
      });
    } else {
      logger.error('Test email failed:', result.error);
      res.status(500).json({
        success: false,
        message: 'Failed to send test email',
        error: result.error,
        errorCode: result.errorCode
      });
    }
    
  } catch (error) {
    logger.error('Test email endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Test email failed',
      error: error.message
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  logger.info(
    `HerHaven Server running in ${process.env.NODE_ENV} mode on port ${PORT}`
  );
});

module.exports = app;
