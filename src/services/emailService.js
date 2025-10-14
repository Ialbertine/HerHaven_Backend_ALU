require("dotenv").config();
const nodemailer = require("nodemailer");
const logger = require("../utils/logger");

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

 initializeTransporter() {
  try {
    // CHANGE 1: Added more detailed logging to help debug on Render
    logger.info("=== EMAIL SERVICE INITIALIZATION ===");
    logger.info(`SMTP_HOST: ${process.env.SMTP_HOST || "NOT SET"}`);
    logger.info(`SMTP_PORT: ${process.env.SMTP_PORT || "NOT SET"}`);
    logger.info(`SMTP_SECURE: ${process.env.SMTP_SECURE || "NOT SET"}`);
    logger.info(`SMTP_USER: ${process.env.SMTP_USER ? "SET" : "NOT SET"}`);
    logger.info(`SMTP_PASS: ${process.env.SMTP_PASS ? "SET" : "NOT SET"}`);

    // Check if required environment variables are set
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      logger.error("SMTP_USER and SMTP_PASS environment variables are required for email service");
      return;
    }

    // CHANGE 2: Converted SMTP_PORT to number (Render might pass it as string)
    const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
    
    // CHANGE 3: Properly handle SMTP_SECURE as boolean (Render passes as string)
    const isSecure = process.env.SMTP_SECURE === "true";

    // CHANGE 4: Added more robust configuration with fallbacks
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: smtpPort,
      secure: isSecure, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      // CHANGE 5: Added more TLS options for better compatibility with Render
      tls: {
        rejectUnauthorized: false,
        ciphers: 'SSLv3' // Added for compatibility
      },
      // CHANGE 6: Added connection timeout and other useful options
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000,
      socketTimeout: 10000,
      // CHANGE 7: Added debug mode (can be enabled via env variable)
      debug: process.env.SMTP_DEBUG === "true",
      logger: process.env.SMTP_DEBUG === "true"
    });

    // CHANGE 8: Made verification async and added more detailed error logging
    this.transporter.verify((error) => {
      if (error) {
        logger.error("=== EMAIL SERVICE VERIFICATION FAILED ===");
        logger.error(`Error name: ${error.name}`);
        logger.error(`Error message: ${error.message}`);
        logger.error(`Error code: ${error.code}`);
        logger.error(`Error stack: ${error.stack}`);
        logger.error("Please check your SMTP configuration in environment variables");
        
        // CHANGE 9: Added specific error guidance
        if (error.code === 'EAUTH') {
          logger.error("Authentication failed. Check if:");
          logger.error("1. Your Gmail App Password is correct");
          logger.error("2. 2-Step Verification is enabled");
          logger.error("3. App Password was created correctly");
        } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNECTION') {
          logger.error("Connection timeout. This might be a network issue on Render.");
          logger.error("Try checking if Render has any firewall restrictions.");
        }
      } else {
        logger.info("=== EMAIL SERVICE VERIFIED SUCCESSFULLY ===");
        logger.info(`SMTP Host: ${process.env.SMTP_HOST || "smtp.gmail.com"}`);
        logger.info(`SMTP User: ${process.env.SMTP_USER}`);
        logger.info(`SMTP Port: ${smtpPort}`);
        logger.info(`SMTP Secure: ${isSecure}`);
      }
    });
  } catch (error) {
    logger.error("=== FAILED TO INITIALIZE EMAIL SERVICE ===");
    logger.error(`Error: ${error.message}`);
    logger.error(`Stack: ${error.stack}`);
  }
}

// ===== CHANGES TO sendEmail() METHOD =====

async sendEmail(to, subject, htmlContent, textContent = null) {
  try {
    // CHANGE 10: Added check if transporter exists
    if (!this.transporter) {
      const errorMsg = "Email transporter not initialized. Check server logs for initialization errors.";
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    // CHANGE 11: Added validation for recipient email
    if (!to || typeof to !== 'string' || !to.includes('@')) {
      throw new Error(`Invalid recipient email: ${to}`);
    }

    const mailOptions = {
      from: `"HerHaven Platform" <${process.env.SMTP_USER}>`,
      to: to,
      subject: subject,
      html: htmlContent,
      text: textContent || this.stripHtml(htmlContent),
    };

    // CHANGE 12: Added more detailed logging before sending
    logger.info(`Attempting to send email to: ${to}`);
    logger.info(`Subject: ${subject}`);

    const result = await this.transporter.sendMail(mailOptions);
    
    // CHANGE 13: Enhanced success logging
    logger.info(`✓ Email sent successfully to ${to}`);
    logger.info(`Message ID: ${result.messageId}`);
    logger.info(`Response: ${result.response}`);

    return {
      success: true,
      messageId: result.messageId,
      message: "Email sent successfully",
    };
  } catch (error) {
    // CHANGE 14: Enhanced error logging with more details
    logger.error(`✗ Failed to send email to ${to}`);
    logger.error(`Error name: ${error.name}`);
    logger.error(`Error message: ${error.message}`);
    logger.error(`Error code: ${error.code}`);
    
    // CHANGE 15: Added specific error messages based on error type
    let userFriendlyMessage = "Failed to send email";
    if (error.code === 'EAUTH') {
      userFriendlyMessage = "Email authentication failed. Please contact support.";
    } else if (error.code === 'ETIMEDOUT') {
      userFriendlyMessage = "Email service timeout. Please try again later.";
    } else if (error.code === 'ECONNECTION') {
      userFriendlyMessage = "Could not connect to email service. Please try again later.";
    }

    return {
      success: false,
      error: error.message,
      errorCode: error.code,
      message: userFriendlyMessage,
    };
  }
}
  // send counselor invitation email

  async sendCounselorInvitation(counselor, inviteToken) {
    const registrationLink = `${process.env.CLIENT_URL || "http://localhost:5000"
      }/counselor/complete-registration/${inviteToken}`;
    const subject = "🎉 You're Invited to Join HerHaven as a Counselor";

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Counselor Invitation</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 8px; }
        .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; }
        .btn { display: inline-block; background: #844ae2ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 15px 0; }
        .info-box { background: #f0e6ff; border-left: 4px solid #844ae2ff; padding: 15px; margin: 15px 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        
        <div class="content">
          <p>Hello ${counselor.firstName} ${counselor.lastName},</p>
          
          <p>You've been invited to join the HerHaven platform as a counselor! We're excited to have you be part of our mission to support and empower women.</p>
          
          <div class="info-box">
            <h4>What You'll Need to Complete Registration:</h4>
            <ul>
              <li>Create a username and password</li>
              <li>Provide your phone number</li>
              <li>Enter your professional license number</li>
              <li>Select your specialization</li>
              <li>Share your years of experience</li>
              <li>Write a brief professional bio</li>
            </ul>
          </div>
          
          <p><strong>Next Steps:</strong></p>
          <ol>
            <li>Click the button below to access the registration form</li>
            <li>Fill in your professional details</li>
            <li>Create your login credentials</li>
            <li>Start helping women in need</li>
          </ol>
          
          <a href="${registrationLink}" class="btn">Complete Registration</a>
          
          <p><strong>Important:</strong> This invitation link will expire in 7 days.</p>
          
          <p>If you have any questions or didn't request this invitation, please contact our support team.</p>
          
          <p>Best regards,<br>
          <strong>The HerHaven Team</strong></p>
        </div>
        
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} HerHaven. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

    return await this.sendEmail(
      counselor.email,
      subject,
      htmlContent,
      this.stripHtml(htmlContent)
    );
  }

  // send counselor registration confirmation email
  async sendCounselorRegistrationConfirmation(counselor) {
    const subject = "HerHaven - Counselor Application Submitted Successfully";

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Application Submitted</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 8px; }
          .content { background: white; padding: 20px; border-radius: 0 0 8px 8px; }
          .status-badge { background: #ffa500; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; margin: 10px 0; }
          .info-box { background: #f0f8ff; border-left: 4px solid #844ae2ff; padding: 15px; margin: 15px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .btn { display: inline-block; background: #844ae2ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">    
          <div class="content">
            <p>Dear <strong>${counselor.firstName} ${counselor.lastName
      }</strong>,</p>
            
            <p>Thank you for your interest in joining the HerHaven counseling platform. We have successfully received your counselor application.</p>
            
            <div class="status-badge">PENDING</div>
            
            <div class="info-box">
              <h3>Application Details:</h3>
              <ul>
                <li><strong>Email:</strong> ${counselor.email}</li>
                <li><strong>Username:</strong> ${counselor.username}</li>
                <li><strong>Specialization:</strong> ${counselor.specialization
      }</li>
                <li><strong>Experience:</strong> ${counselor.experience
      } years</li>
                <li><strong>License Number:</strong> ${counselor.licenseNumber
      }</li>
                <li><strong>Application ID:</strong> ${counselor._id}</li>
              </ul>
            </div>
            
            <div class="info-box">
              <p>Your application is now under review. Our team will carefully verify your information and credentials, and you'll be notified by email once a decision has been made. We truly value your commitment to supporting women through HerHaven, we are excited to have you join our community and we'll be in touch soon.</p>
            </div>
            
            <p>If you have any questions, please don't hesitate to contact our support team.</p>
            
            <p>Best regards,<br>
            <strong>The HerHaven Team</strong></p>
          </div>
          
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>&copy; ${new Date().getFullYear()} HerHaven Platform. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(counselor.email, subject, htmlContent);
  }

  async sendAdminNewApplicationAlert(counselor, adminEmail) {
    const subject = "New Counselor Application - HerHaven Platform";

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Counselor Application</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 8px; }
          .content { background: white; padding: 20px; border-radius: 0 0 8px 8px; }
          .urgent-badge { background:rgb(231, 60, 200); color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; margin: 10px 0; }
          .info-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0; }
          .counselor-info { background: #f8f9fa; border: 1px solid #844ae2ff; padding: 15px; margin: 15px 0; border-radius: 5px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .btn { display: inline-block; background: #844ae2ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">    
          <div class="content">
            <p>Hello,</p>
            
            <p>A new counselor has submitted an application for review on the HerHaven platform.</p>
            
            <div class="urgent-badge">REQUIRES REVIEW</div>
            
            <div class="counselor-info">
              <h3>Counselor Information:</h3>
              <ul>
                <li><strong>Name:</strong> ${counselor.firstName} ${counselor.lastName
      }</li>
                <li><strong>Email:</strong> ${counselor.email}</li>
                <li><strong>Username:</strong> ${counselor.username}</li>
                <li><strong>Phone:</strong> ${counselor.phoneNumber}</li>
                <li><strong>Specialization:</strong> ${counselor.specialization
      }</li>
                <li><strong>Experience:</strong> ${counselor.experience
      } years</li>
                <li><strong>License Number:</strong> ${counselor.licenseNumber
      }</li>
                <li><strong>Application ID:</strong> ${counselor._id}</li>
                <li><strong>Applied:</strong> ${new Date(
        counselor.createdAt
      ).toLocaleString()}</li>
              </ul>
              
              ${counselor.bio
        ? `<p><strong>Bio:</strong><br>${counselor.bio}</p>`
        : ""
      }
            </div>
            
            <div class="info-box">
              <h4> Action Required</h4>
              <p>Please log into the admin dashboard to review this application and make a decision (approve/reject).</p>
            </div>
            
            <p><strong>Quick Access:</strong></p>
            <a href="${process.env.CLIENT_URL || "http://localhost:5000"
      }/api/auth/login" class="btn">
              Login to Admin Dashboard
            </a>
            
            <p><strong>Review Checklist:</strong></p>
            <ul>
              <li>Verify license number</li>
              <li>Check specialization alignment</li>
              <li>Review experience level</li>
              <li>Validate contact information</li>
              <li>Assess bio quality</li>
            </ul>
            
            <p>Best regards,<br>
            <strong>HerHaven System</strong></p>
          </div>
          
          <div class="footer">
            <p>This is an automated admin notification.</p>
            <p>&copy; ${new Date().getFullYear()} HerHaven Platform. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(adminEmail, subject, htmlContent);
  }

  async sendCounselorApprovalNotification(counselor) {
    const subject =
      "🎉 Congratulations! Your HerHaven Application Has Been Approved";

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Application Approved</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 8px; }
          .content { background: white; padding: 20px; border-radius: 0 0 8px 8px; }
          .success-badge { background: #844ae2ff; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; margin: 10px 0; }
          .info-box { background: #e8d4edff; border-left: 4px solid #844ae2ff; padding: 15px; margin: 15px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .btn { display: inline-block; background: #844ae2ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="content">
            <p>Dear <strong>${counselor.firstName} ${counselor.lastName
      }</strong>,</p>
            
            <p>We're thrilled to inform you that your counselor application has been <strong>APPROVED</strong> by our team!</p>
            
            <div class="success-badge">APPROVED</div>
            
            
            <h3>Next Steps:</h3>
            <ol>
              <li>Log into your counselor account using your credentials</li>
              <li>Complete your profile setup</li>
              <li>Set your availability schedule</li>
              <li>Start accepting appointment requests</li>
            </ol>
            
            <p><strong>Access Your Dashboard:</strong></p>

            <a href="${process.env.CLIENT_URL || "http://localhost:5000"
      }/api/auth/login" class="btn">
              Login to access your dashboard
            </a>
            
            <div class="info-box">
              <h4>Need Help?</h4>
              <p>If you have any questions or need assistance getting started, please don't hesitate to contact our support team.</p>
            </div>
            
            <p>Welcome to the HerHaven family! We're excited to have you on board.</p>
            
            <p>Best regards,<br>
            <strong>The HerHaven Team</strong></p>
          </div>
          
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>&copy; ${new Date().getFullYear()} HerHaven Platform. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(counselor.email, subject, htmlContent);
  }

  async sendCounselorRejectionNotification(
    counselor,
    rejectionReason,
    rejectedByAdmin
  ) {
    const subject = "HerHaven - Application Status Update";

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Application Status Update</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 8px; }
          .content { background: white; padding: 20px; border-radius: 0 0 8px 8px; }
          .status-badge { background: #dc3545; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; margin: 10px 0; }
          .info-box { background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 15px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .btn { display: inline-block; background: #844ae2ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          
          <div class="content">
            <p>Dear <strong>${counselor.firstName} ${counselor.lastName
      }</strong>,</p>
            
            <p>Thank you for your interest in joining the HerHaven counseling platform. After careful review of your application, we regret to inform you that it was not approved at this time.</p>
            <p>We prioritized several factors during our review process, including qualifications, experience, and alignment with our platform's mission. Unfortunately, we found that your application did not fully meet our current requirements.</p>
            
            <div class="status-badge"> NOT APPROVED</div>
            
            <div class="info-box">
              <h4>Feedback:</h4>
              <p><strong>Reason:</strong> ${rejectionReason ||
      "Application does not meet current platform requirements."
      }</p>
              <p><strong>Reviewed by:</strong> ${rejectedByAdmin?.firstName || "Admin"
      } ${rejectedByAdmin?.lastName || ""}</p>
              <p><strong>Review Date:</strong> ${new Date().toLocaleDateString()}</p>
            </div>
            
            <p>If you have any questions about this decision, please contact our support team.</p>
            
            <p>Best regards,<br>
            <strong>The HerHaven Team</strong></p>
          </div>
          
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>&copy; ${new Date().getFullYear()} HerHaven Platform. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(counselor.email, subject, htmlContent);
  }

  // Add this to your EmailService class

  async sendAppointmentBookedToCounselor(counselor, user, appointment) {
    const subject = "🎉 New Appointment Booked - HerHaven";

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Appointment</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 8px; }
        .content { background: white; padding: 30px; border-radius: 8px; }
        .info-box { background: #f0e6ff; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="content">
          <h2>New Appointment Booked! 🎉</h2>
          
          <p>Hello Dr. ${counselor.lastName},</p>
          
          <p>You have a new appointment booking with a client:</p>
          
          <div class="info-box">
            <h3>Appointment Details:</h3>
            <p><strong>Client Name:</strong> ${user.firstName} ${user.lastName
      }</p>
            <p><strong>Date:</strong> ${new Date(
        appointment.appointmentDate
      ).toLocaleDateString()}</p>
            <p><strong>Time:</strong> ${appointment.appointmentTime}</p>
            <p><strong>Status:</strong> ${appointment.status}</p>
          </div>
          
          <p>Please check your counselor dashboard for complete details and to manage your schedule.</p>
          
          <p>Best regards,<br>
          <strong>The HerHaven Team</strong></p>
        </div>
        
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} HerHaven. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

    return await this.sendEmail(counselor.email, subject, htmlContent);
  }

  async sendAppointmentConfirmedToUser(user, counselor, appointment) {
    const subject = "✅ Appointment Confirmed - HerHaven";

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Appointment Confirmed</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 8px; }
        .content { background: white; padding: 30px; border-radius: 8px; }
        .info-box { background: #e6f7e6; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="content">
          <h2>Appointment Confirmed! ✅</h2>
          
          <p>Hello ${user.firstName},</p>
          
          <p>Your appointment has been confirmed by your counselor:</p>
          
          <div class="info-box">
            <h3>Appointment Details:</h3>
            <p><strong>Counselor:</strong> Dr. ${counselor.lastName}</p>
            <p><strong>Specialization:</strong> ${counselor.specialization}</p>
            <p><strong>Date:</strong> ${new Date(
      appointment.appointmentDate
    ).toLocaleDateString()}</p>
            <p><strong>Time:</strong> ${appointment.appointmentTime}</p>
            <p><strong>Status:</strong> Confirmed</p>
          </div>
          
          <p>We look forward to supporting you on your journey.</p>
          
          <p>Best regards,<br>
          <strong>The HerHaven Team</strong></p>
        </div>
        
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} HerHaven. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

    return await this.sendEmail(user.email, subject, htmlContent);
  }

  async sendAppointmentReminderToUser(
    user,
    counselor,
    appointment,
    reminderType
  ) {
    const timeText = reminderType === "24h" ? "24 hours" : "1 hour";
    const subject = `Appointment Reminder - ${timeText} to go`;

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Appointment Reminder</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 8px; }
        .content { background: white; padding: 30px; border-radius: 8px; }
        .info-box { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="content">
          <h2>Appointment Reminder</h2>
          
          <p>Hello ${user.firstName},</p>
          
          <p>This is a friendly reminder about your upcoming appointment:</p>
          
          <div class="info-box">
            <h3>Appointment Details:</h3>
            <p><strong>Counselor:</strong> Dr. ${counselor.lastName}</p>
            <p><strong>Date:</strong> ${new Date(
      appointment.appointmentDate
    ).toLocaleDateString()}</p>
            <p><strong>Time:</strong> ${appointment.appointmentTime}</p>
            <p><strong>Starts in:</strong> ${timeText}</p>
          </div>
          
          <p>Please be ready for your session. We're here to support you!</p>
          
          <p>Best regards,<br>
          <strong>The HerHaven Team</strong></p>
        </div>
        
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} HerHaven. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

    return await this.sendEmail(user.email, subject, htmlContent);
  }

  async sendSessionStartingToUser(
    user,
    counselor,
    appointment,
    meetingLink = null
  ) {
    const subject = "Your Session is Starting Soon - HerHaven";

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Session Starting</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 8px; }
        .content { background: white; padding: 30px; border-radius: 8px; }
        .info-box { background: #e6f3ff; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .btn { display: inline-block; background: #844ae2ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="content">
          <h2>Session Starting Soon!</h2>
          
          <p>Hello ${user.firstName},</p>
          
          <p>Your counseling session is about to begin:</p>
          
          <div class="info-box">
            <h3>Session Details:</h3>
            <p><strong>Counselor:</strong> Dr. ${counselor.lastName}</p>
            <p><strong>Date:</strong> ${new Date(
      appointment.appointmentDate
    ).toLocaleDateString()}</p>
            <p><strong>Time:</strong> ${appointment.appointmentTime}</p>
            <p><strong>Status:</strong> Starting soon</p>
          </div>
          
          ${meetingLink
        ? `
          <p><strong>Join your session:</strong></p>
          <a href="${meetingLink}" class="btn">Join Session Now</a>
          `
        : `
          <p>Please proceed to your session area in the app.</p>
          `
      }
          
          <p>We hope you have a productive session!</p>
          
          <p>Best regards,<br>
          <strong>The HerHaven Team</strong></p>
        </div>
        
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} HerHaven. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

    return await this.sendEmail(user.email, subject, htmlContent);
  }

  stripHtml(html) {
    return html
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  async sendBulkEmailToAdmins(adminEmails, subject, htmlContent) {
    const results = [];

    for (const email of adminEmails) {
      try {
        const result = await this.sendEmail(email, subject, htmlContent);
        results.push({ email, result });
      } catch (error) {
        results.push({
          email,
          result: { success: false, error: error.message },
        });
      }
    }

    return results;
  }
}

module.exports = new EmailService();
