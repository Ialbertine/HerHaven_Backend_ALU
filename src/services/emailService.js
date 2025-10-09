require('dotenv').config();
const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    try {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      this.transporter.verify((error) => {
        if (error) {
          logger.error('Email service initialization failed:', error);
        } else {
          logger.info('Email service initialized successfully');
        }
      });

    } catch (error) {
      logger.error('Failed to initialize email service:', error);
    }
  }

  async sendEmail(to, subject, htmlContent, textContent = null) {
    try {
      if (!this.transporter) {
        throw new Error('Email transporter not initialized');
      }

      const mailOptions = {
        from: `"HerHaven Platform" <${process.env.SMTP_USER}>`,
        to: to,
        subject: subject,
        html: htmlContent,
        text: textContent || this.stripHtml(htmlContent)
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent successfully to ${to}: ${result.messageId}`);

      return {
        success: true,
        messageId: result.messageId,
        message: 'Email sent successfully'
      };

    } catch (error) {
      logger.error(`Failed to send email to ${to}:`, error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to send email'
      };
    }
  }

  async sendCounselorRegistrationConfirmation(counselor) {
    const subject = 'HerHaven - Counselor Application Submitted Successfully';

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
          .header { background: #844ae2ff; color: white; padding: 16px; text-align: center; border-radius: 8px 8px 0 0; margin: -20px -20px 20px -20px; }
          .content { background: white; padding: 20px; border-radius: 0 0 8px 8px; }
          .status-badge { background: #ffa500; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; margin: 10px 0; }
          .info-box { background: #f0f8ff; border-left: 4px solid #844ae2ff; padding: 15px; margin: 15px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .btn { display: inline-block; background: #844ae2ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>HerHaven Platform</h1>
            <h2>Application Submitted Successfully</h2>
          </div>
          
          <div class="content">
            <p>Dear <strong>${counselor.firstName} ${counselor.lastName}</strong>,</p>
            
            <p>Thank you for your interest in joining the HerHaven counseling platform. We have successfully received your counselor application.</p>
            
            <div class="status-badge">PENDING</div>
            
            <div class="info-box">
              <h3>Application Details:</h3>
              <ul>
                <li><strong>Email:</strong> ${counselor.email}</li>
                <li><strong>Username:</strong> ${counselor.username}</li>
                <li><strong>Specialization:</strong> ${counselor.specialization}</li>
                <li><strong>Experience:</strong> ${counselor.experience} years</li>
                <li><strong>License Number:</strong> ${counselor.licenseNumber}</li>
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
            <p>© 2025 HerHaven Platform. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(counselor.email, subject, htmlContent);
  }

  async sendAdminNewApplicationAlert(counselor, adminEmail) {
    const subject = 'New Counselor Application - HerHaven Platform';

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
          .header { background: #844ae2ff; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; margin: -20px -20px 20px -20px; }
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
          <div class="header">
            <h1>Admin Alert</h1>
            <h2>New Counselor Application</h2>
          </div>
          
          <div class="content">
            <p>Hello Admin,</p>
            
            <p>A new counselor has submitted an application for review on the HerHaven platform.</p>
            
            <div class="urgent-badge">REQUIRES REVIEW</div>
            
            <div class="counselor-info">
              <h3>Counselor Information:</h3>
              <ul>
                <li><strong>Name:</strong> ${counselor.firstName} ${counselor.lastName}</li>
                <li><strong>Email:</strong> ${counselor.email}</li>
                <li><strong>Username:</strong> ${counselor.username}</li>
                <li><strong>Phone:</strong> ${counselor.phoneNumber}</li>
                <li><strong>Specialization:</strong> ${counselor.specialization}</li>
                <li><strong>Experience:</strong> ${counselor.experience} years</li>
                <li><strong>License Number:</strong> ${counselor.licenseNumber}</li>
                <li><strong>Application ID:</strong> ${counselor._id}</li>
                <li><strong>Applied:</strong> ${new Date(counselor.createdAt).toLocaleString()}</li>
              </ul>
              
              ${counselor.bio ? `<p><strong>Bio:</strong><br>${counselor.bio}</p>` : ''}
            </div>
            
            <div class="info-box">
              <h4> Action Required</h4>
              <p>Please log into the admin dashboard to review this application and make a decision (approve/reject).</p>
            </div>
            
            <p><strong>Quick Access:</strong></p>
            <a href="${process.env.CLIENT_URL || 'http://localhost:5000'}/api/auth/login" class="btn">
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
            <p>© 2025 HerHaven Platform. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(adminEmail, subject, htmlContent);
  }

  async sendCounselorApprovalNotification(counselor) {
    const subject = '🎉 Congratulations! Your HerHaven Application Has Been Approved';

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
          .header { background: #844ae2ff; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; margin: -20px -20px 20px -20px; }
          .content { background: white; padding: 20px; border-radius: 0 0 8px 8px; }
          .success-badge { background: #28a745; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; margin: 10px 0; }
          .info-box { background: #e8d4edff; border-left: 4px solid #844ae2ff; padding: 15px; margin: 15px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .btn { display: inline-block; background: #844ae2ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Congratulations!</h1>
            <h2>Application Approved</h2>
          </div>
          
          <div class="content">
            <p>Dear <strong>${counselor.firstName} ${counselor.lastName}</strong>,</p>
            
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

            <a href="${process.env.CLIENT_URL || 'http://localhost:5000'}/api/auth/login" class="btn">
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
            <p>© 2025 HerHaven Platform. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(counselor.email, subject, htmlContent);
  }

  async sendCounselorRejectionNotification(counselor, rejectionReason, rejectedByAdmin) {
    const subject = 'HerHaven - Application Status Update';

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
            <p>Dear <strong>${counselor.firstName} ${counselor.lastName}</strong>,</p>
            
            <p>Thank you for your interest in joining the HerHaven counseling platform. After careful review of your application, we regret to inform you that it was not approved at this time.</p>
            <p>We prioritized several factors during our review process, including qualifications, experience, and alignment with our platform's mission. Unfortunately, we found that your application did not fully meet our current requirements.</p>
            
            <div class="status-badge"> NOT APPROVED</div>
            
            <div class="info-box">
              <h4>Feedback:</h4>
              <p><strong>Reason:</strong> ${rejectionReason || 'Application does not meet current platform requirements.'}</p>
              <p><strong>Reviewed by:</strong> ${rejectedByAdmin?.firstName || 'Admin'} ${rejectedByAdmin?.lastName || ''}</p>
              <p><strong>Review Date:</strong> ${new Date().toLocaleDateString()}</p>
            </div>
            
            <p>If you have any questions about this decision, please contact our support team.</p>
            
            <p>Best regards,<br>
            <strong>The HerHaven Team</strong></p>
          </div>
          
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>© 2025 HerHaven Platform. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(counselor.email, subject, htmlContent);
  }

  stripHtml(html) {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  async sendBulkEmailToAdmins(adminEmails, subject, htmlContent) {
    const results = [];

    for (const email of adminEmails) {
      try {
        const result = await this.sendEmail(email, subject, htmlContent);
        results.push({ email, result });
      } catch (error) {
        results.push({ email, result: { success: false, error: error.message } });
      }
    }

    return results;
  }
}

module.exports = new EmailService();
