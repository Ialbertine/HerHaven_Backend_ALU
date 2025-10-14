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

// Email health check endpoint
app.get("/api/email-health", async (req, res) => {
  try {
    // Import your email service (adjust the path as needed)
    const EmailService = require("./services/emailService");
    const emailService = new EmailService();
    
    // Check if email service is initialized
    if (!emailService.transporter) {
      return res.status(503).json({ 
        success: false,
        status: 'unhealthy', 
        message: 'Email transporter not initialized' 
      });
    }

    // Test the SMTP connection
    await emailService.transporter.verify();
    
    // Get email configuration (without showing password)
    const smtpConfig = {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER,
      hasPassword: !!process.env.SMTP_PASS,
      adminEmail: process.env.ADMIN_EMAIL
    };

    // Optional: Send a test email if ADMIN_EMAIL is set
    let testEmailResult = null;
    if (process.env.ADMIN_EMAIL) {
      testEmailResult = await emailService.sendEmail(
        process.env.ADMIN_EMAIL,
        'Email Service Test - HerHaven Backend',
        `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Email Service Test</h2>
            <p>This is a test email from your HerHaven backend deployed on Render.</p>
            <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
            <p><strong>Environment:</strong> ${process.env.NODE_ENV}</p>
            <p>If you received this email, your email service is working correctly!</p>
          </div>
        `,
        `Email Service Test - ${new Date().toISOString()} - This is a test email from your HerHaven backend.`
      );
    }

    res.json({
      success: true,
      status: 'healthy',
      message: 'Email service is working correctly',
      smtpConfig: smtpConfig,
      testEmail: testEmailResult,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Email health check failed:', error);
    
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      message: 'Email service is not working',
      error: error.message,
      smtpConfig: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        user: process.env.SMTP_USER,
        hasPassword: !!process.env.SMTP_PASS
      },
      timestamp: new Date().toISOString()
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
