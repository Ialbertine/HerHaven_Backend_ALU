const mongoose = require('mongoose');
const crypto = require('crypto');
const AssessmentTemplate = require('../models/assessmentTemplate');
const AssessmentResponse = require('../models/assessmentResponse');
const Counselor = require('../models/counselor');
const assessmentService = require('../services/assessmentService');
const notificationController = require('../controllers/notificationController');
const logger = require('../utils/logger');

const assessmentController = {
  // Admin routes for assessment templates
  // Create new assessment template (Admin only)
  createTemplate: async (req, res) => {
    try {
      const templateData = req.body;
      templateData.createdBy = req.user._id;

      const template = new AssessmentTemplate(templateData);
      await template.save();

      logger.info(`Assessment template created: ${template.name} by admin ${req.user.username}`);

      res.status(201).json({
        success: true,
        message: 'Assessment template created successfully',
        data: { template }
      });
    } catch (error) {
      logger.error('Create template error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create assessment template',
        error: error.message
      });
    }
  },

  // Get all assessment templates
  getTemplates: async (req, res) => {
    try {
      const { category, isActive, isPublished } = req.query;

      const filter = {};

      if (category) filter.category = category;
      if (isActive !== undefined) filter.isActive = isActive === 'true';
      if (isPublished !== undefined) filter.isPublished = isPublished === 'true';

      // Non-admin users can only see published templates
      if (req.user.role !== 'admin') {
        filter.isPublished = true;
        filter.isActive = true;
      }

      const templates = await AssessmentTemplate.find(filter)
        .select('-createdBy')
        .sort({ category: 1, name: 1 });

      res.json({
        success: true,
        message: 'Assessment templates retrieved',
        data: {
          templates,
          count: templates.length
        }
      });
    } catch (error) {
      logger.error('Get templates error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve assessment templates'
      });
    }
  },

  // Get single assessment template
  getTemplateById: async (req, res) => {
    try {
      const { templateId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(templateId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid template ID format'
        });
      }

      const template = await AssessmentTemplate.findById(templateId);

      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Assessment template not found'
        });
      }

      // Check if user can access this template
      if (req.user.role !== 'admin' && (!template.isPublished || !template.isActive)) {
        return res.status(403).json({
          success: false,
          message: 'This assessment is not available'
        });
      }

      res.json({
        success: true,
        message: 'Assessment template retrieved',
        data: { template }
      });
    } catch (error) {
      logger.error('Get template by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve assessment template'
      });
    }
  },

  // Update assessment template (Admin only)
  updateTemplate: async (req, res) => {
    try {
      const { templateId } = req.params;
      const updates = req.body;

      if (!mongoose.Types.ObjectId.isValid(templateId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid template ID format'
        });
      }

      const template = await AssessmentTemplate.findByIdAndUpdate(
        templateId,
        { $set: updates },
        { new: true, runValidators: true }
      );

      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Assessment template not found'
        });
      }

      logger.info(`Assessment template updated: ${template.name} by admin ${req.user.username}`);

      res.json({
        success: true,
        message: 'Assessment template updated successfully',
        data: { template }
      });
    } catch (error) {
      logger.error('Update template error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update assessment template',
        error: error.message
      });
    }
  },

  // Delete assessment template (Admin only)
  deleteTemplate: async (req, res) => {
    try {
      const { templateId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(templateId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid template ID format'
        });
      }

      // Check if template has any responses
      const responseCount = await AssessmentResponse.countDocuments({
        template: templateId
      });

      if (responseCount > 0) {
        // Soft delete by deactivating instead
        await AssessmentTemplate.findByIdAndUpdate(templateId, {
          isActive: false,
          isPublished: false
        });

        return res.json({
          success: true,
          message: `Template deactivated instead of deleted (has ${responseCount} responses)`,
        });
      }

      await AssessmentTemplate.findByIdAndDelete(templateId);

      logger.info(`Assessment template deleted: ${templateId} by admin ${req.user.username}`);

      res.json({
        success: true,
        message: 'Assessment template deleted successfully'
      });
    } catch (error) {
      logger.error('Delete template error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete assessment template'
      });
    }
  },

  // Assessment submission routes
  // Submit assessment response
  submitAssessment: async (req, res) => {
    try {
      const { templateId, responses, isAnonymous, shareWithCounselor, counselorId, userNotes } = req.body;
      const userId = req.user ? req.user._id : null;

      if (!mongoose.Types.ObjectId.isValid(templateId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid template ID format'
        });
      }

      // Get template
      const template = await AssessmentTemplate.findOne({
        _id: templateId,
        isActive: true,
        isPublished: true
      });

      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Assessment template not found or not available'
        });
      }

      // Calculate score
      const { totalScore, scoredResponses } = await assessmentService.calculateScore(template, responses);

      // Get severity level
      const severityLevel = template.getSeverityLevel(totalScore);

      // Detect crisis
      const { isCrisis, crisisIndicators } = await assessmentService.detectCrisis(template, responses);

      // Generate recommendations
      const recommendations = await assessmentService.generateRecommendations(
        template,
        totalScore,
        severityLevel?.name
      );

      // Create assessment response
      const assessmentData = {
        user: userId,
        template: templateId,
        templateSnapshot: {
          name: template.name,
          version: template.version,
          category: template.category
        },
        responses: scoredResponses,
        totalScore,
        severityLevel: severityLevel?.name || 'Unknown',
        isCrisis,
        crisisIndicators,
        status: 'completed',
        completedAt: new Date(),
        isAnonymous,
        shareWithCounselor,
        userNotes,
        recommendations
      };

      // Generate session ID for anonymous users
      if (isAnonymous || !userId) {
        assessmentData.sessionId = crypto.randomBytes(16).toString('hex');
        assessmentData.isAnonymous = true;
      }

      // Handle counselor sharing
      if (shareWithCounselor && counselorId && mongoose.Types.ObjectId.isValid(counselorId)) {
        const counselor = await Counselor.findById(counselorId);
        if (counselor) {
          assessmentData.sharedWith = [{
            counselor: counselorId,
            sharedAt: new Date()
          }];
        }
      }

      const assessment = new AssessmentResponse(assessmentData);
      await assessment.save();

      // Update template usage stats
      await AssessmentTemplate.findByIdAndUpdate(templateId, {
        $inc: { totalResponses: 1 },
        lastUsed: new Date()
      });

      // Handle follow-up actions
      const followUpActions = [];

      // Crisis response
      if (isCrisis) {
        // Create urgent notification for user (if not anonymous)
        if (userId) {
          await notificationController.createNotification(
            userId,
            'Assessment detected crisis',
            'We\'re Here for You',
            'Thank you for completing your assessment. Your responses show you may be going through a difficult time. You don\'t have to face this alone - support is available. Consider connecting with a counselor or reaching out to someone you trust.',
            {
              assessment: assessment._id,
              channels: ['inApp'],
              priority: 'high'
            }
          );

          // Notify counselor if shared
          if (shareWithCounselor && counselorId) {
            await notificationController.createNotification(
              counselorId,
              'assessment_crisis_shared',
              'Urgent: High-Risk Assessment Shared',
              `A user has shared a high-risk assessment with you that requires attention.`,
              {
                assessment: assessment._id,
                user: userId,
                channels: ['inApp'],
                priority: 'high'
              }
            );

            followUpActions.push({
              action: 'counselor_notified',
              performedAt: new Date(),
              details: { counselorId }
            });
          }
        }

        logger.warn(`Crisis detected in assessment ${assessment._id} for ${userId || 'anonymous user'}`);
      }

      // Regular counselor notification (if shared)
      if (shareWithCounselor && counselorId && !isCrisis && userId) {
        await notificationController.createNotification(
          counselorId,
          'assessment_shared',
          'New Assessment Shared',
          `A user has shared their ${template.name} assessment with you.`,
          {
            assessment: assessment._id,
            user: userId,
            channels: ['inApp']
          }
        );

        followUpActions.push({
          action: 'counselor_notified',
          performedAt: new Date(),
          details: { counselorId }
        });
      }

      // Save follow-up actions
      if (followUpActions.length > 0) {
        assessment.followUpActions = followUpActions;
        await assessment.save();
      }

      logger.info(`Assessment completed: ${assessment._id} for template ${template.name}`);

      res.status(201).json({
        success: true,
        message: 'Assessment submitted successfully',
        data: {
          assessment: {
            id: assessment._id,
            sessionId: assessment.sessionId,
            totalScore,
            severityLevel: severityLevel?.name,
            isCrisis,
            recommendations,
            completedAt: assessment.completedAt
          }
        }
      });
    } catch (error) {
      logger.error('Submit assessment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to submit assessment',
        error: error.message
      });
    }
  },

  // Submit anonymous assessment
  submitAnonymousAssessment: async (req, res) => {
    try {
      // Set user to null and force anonymous mode
      req.user = null;
      req.body.isAnonymous = true;

      // Reuse the main submission logic
      return await assessmentController.submitAssessment(req, res);
    } catch (error) {
      logger.error('Submit anonymous assessment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to submit anonymous assessment',
        error: error.message
      });
    }
  },


  // Get user's assessment history
  getMyAssessments: async (req, res) => {
    try {
      const userId = req.user._id;
      const { category, status, limit = 20, page = 1 } = req.query;

      const filter = {
        user: userId,
        isDeleted: false
      };

      if (category) filter['templateSnapshot.category'] = category;
      if (status) filter.status = status;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const assessments = await AssessmentResponse.find(filter)
        .populate('template', 'name category description')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(skip);

      const totalCount = await AssessmentResponse.countDocuments(filter);

      res.json({
        success: true,
        message: 'User assessments retrieved',
        data: {
          assessments,
          pagination: {
            total: totalCount,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(totalCount / parseInt(limit))
          }
        }
      });
    } catch (error) {
      logger.error('Get my assessments error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve assessments'
      });
    }
  },

  // Get specific assessment by ID
  getAssessmentById: async (req, res) => {
    try {
      const { assessmentId } = req.params;
      const userId = req.user._id;

      if (!mongoose.Types.ObjectId.isValid(assessmentId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid assessment ID format'
        });
      }

      const assessment = await AssessmentResponse.findOne({
        _id: assessmentId,
        isDeleted: false
      }).populate('template', 'name category description questions scoringRules');

      if (!assessment) {
        return res.status(404).json({
          success: false,
          message: 'Assessment not found'
        });
      }

      // Check access permissions
      const isOwner = assessment.isOwnedBy(userId);
      const isCounselor = req.user.role === 'counselor' && assessment.canBeAccessedBy(userId);

      if (!isOwner && !isCounselor) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view this assessment'
        });
      }

      // Mark as viewed if counselor
      if (isCounselor) {
        await assessment.markViewedBy(userId);
      }

      res.json({
        success: true,
        message: 'Assessment retrieved',
        data: { assessment }
      });
    } catch (error) {
      logger.error('Get assessment by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve assessment'
      });
    }
  },

  // Get assessment by session ID (for anonymous users)
  getAssessmentBySession: async (req, res) => {
    try {
      const { sessionId } = req.params;

      const assessment = await AssessmentResponse.findOne({
        sessionId,
        isAnonymous: true,
        isDeleted: false
      }).populate('template', 'name category description');

      if (!assessment) {
        return res.status(404).json({
          success: false,
          message: 'Assessment not found or expired'
        });
      }

      res.json({
        success: true,
        message: 'Assessment retrieved',
        data: {
          assessment: {
            id: assessment._id,
            sessionId: assessment.sessionId,
            totalScore: assessment.totalScore,
            severityLevel: assessment.severityLevel,
            isCrisis: assessment.isCrisis,
            recommendations: assessment.recommendations,
            completedAt: assessment.completedAt,
            template: assessment.template
          }
        }
      });
    } catch (error) {
      logger.error('Get assessment by session error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve assessment'
      });
    }
  },

  // Get assessment recommendations
  getRecommendations: async (req, res) => {
    try {
      const { assessmentId } = req.params;
      const userId = req.user._id;

      if (!mongoose.Types.ObjectId.isValid(assessmentId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid assessment ID format'
        });
      }

      const assessment = await AssessmentResponse.findOne({
        _id: assessmentId,
        user: userId,
        isDeleted: false
      });

      if (!assessment) {
        return res.status(404).json({
          success: false,
          message: 'Assessment not found'
        });
      }

      res.json({
        success: true,
        message: 'Recommendations retrieved',
        data: {
          recommendations: assessment.recommendations,
          severityLevel: assessment.severityLevel,
          isCrisis: assessment.isCrisis
        }
      });
    } catch (error) {
      logger.error('Get recommendations error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve recommendations'
      });
    }
  },


  // Get user's assessment analytics and trends
  getAnalytics: async (req, res) => {
    try {
      const userId = req.user._id;
      const { templateId } = req.query;

      const analytics = await assessmentService.getAssessmentAnalytics(
        userId,
        templateId || null
      );

      res.json({
        success: true,
        message: 'Assessment analytics retrieved',
        data: analytics
      });
    } catch (error) {
      logger.error('Get analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve analytics'
      });
    }
  },

  // Check if user should retake assessment
  checkRetake: async (req, res) => {
    try {
      const userId = req.user._id;
      const { templateId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(templateId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid template ID format'
        });
      }

      const retakeInfo = await assessmentService.shouldRetakeAssessment(userId, templateId);

      res.json({
        success: true,
        message: 'Retake recommendation retrieved',
        data: retakeInfo
      });
    } catch (error) {
      logger.error('Check retake error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check retake status'
      });
    }
  },

  // Share assessment with counselor
  shareWithCounselor: async (req, res) => {
    try {
      const { assessmentId } = req.params;
      const { counselorId } = req.body;
      const userId = req.user._id;

      if (!mongoose.Types.ObjectId.isValid(assessmentId) || !mongoose.Types.ObjectId.isValid(counselorId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid ID format'
        });
      }

      const assessment = await AssessmentResponse.findOne({
        _id: assessmentId,
        user: userId,
        isDeleted: false
      });

      if (!assessment) {
        return res.status(404).json({
          success: false,
          message: 'Assessment not found'
        });
      }

      // Verify counselor exists
      const counselor = await Counselor.findOne({
        _id: counselorId,
        isActive: true,
        isVerified: true
      });

      if (!counselor) {
        return res.status(404).json({
          success: false,
          message: 'Counselor not found or not available'
        });
      }

      // Check if already shared
      const alreadyShared = assessment.sharedWith.some(
        share => share.counselor.toString() === counselorId.toString()
      );

      if (alreadyShared) {
        return res.status(400).json({
          success: false,
          message: 'Assessment already shared with this counselor'
        });
      }

      // Add to shared list
      assessment.shareWithCounselor = true;
      assessment.sharedWith.push({
        counselor: counselorId,
        sharedAt: new Date()
      });

      await assessment.save();

      // Notify counselor
      await notificationController.createNotification(
        counselorId,
        'assessment_shared',
        'Assessment Shared With You',
        `${req.user.username} has shared an assessment with you.`,
        {
          assessment: assessment._id,
          user: userId,
          channels: ['inApp']
        }
      );

      logger.info(`Assessment ${assessmentId} shared with counselor ${counselorId}`);

      res.json({
        success: true,
        message: 'Assessment shared with counselor successfully',
        data: {
          assessmentId: assessment._id,
          sharedWith: counselor.username
        }
      });
    } catch (error) {
      logger.error('Share with counselor error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to share assessment',
        error: error.message
      });
    }
  },

  // Get assessments shared with counselor
  getSharedAssessments: async (req, res) => {
    try {
      const counselorId = req.user._id;
      const { status, unviewed } = req.query;

      const filter = {
        'sharedWith.counselor': counselorId,
        shareWithCounselor: true,
        isDeleted: false
      };

      if (status) filter.status = status;
      if (unviewed === 'true') {
        filter['sharedWith.viewedAt'] = { $exists: false };
      }

      const assessments = await AssessmentResponse.find(filter)
        .populate('user', 'username email')
        .populate('template', 'name category')
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        message: 'Shared assessments retrieved',
        data: {
          assessments,
          count: assessments.length
        }
      });
    } catch (error) {
      logger.error('Get shared assessments error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve shared assessments'
      });
    }
  },

  // Add counselor notes to assessment
  addCounselorNotes: async (req, res) => {
    try {
      const { assessmentId } = req.params;
      const { notes } = req.body;
      const counselorId = req.user._id;

      if (!mongoose.Types.ObjectId.isValid(assessmentId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid assessment ID format'
        });
      }

      const assessment = await AssessmentResponse.findOne({
        _id: assessmentId,
        isDeleted: false
      });

      if (!assessment) {
        return res.status(404).json({
          success: false,
          message: 'Assessment not found'
        });
      }

      // Verify counselor has access
      if (!assessment.canBeAccessedBy(counselorId)) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to add notes to this assessment'
        });
      }

      assessment.counselorNotes = notes;
      await assessment.save();

      logger.info(`Counselor notes added to assessment ${assessmentId}`);

      res.json({
        success: true,
        message: 'Notes added successfully',
        data: {
          assessmentId: assessment._id,
          counselorNotes: assessment.counselorNotes
        }
      });
    } catch (error) {
      logger.error('Add counselor notes error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add notes'
      });
    }
  },


  // ASSESSMENT MANAGEMENT
  // Update user notes
  updateUserNotes: async (req, res) => {
    try {
      const { assessmentId } = req.params;
      const { notes } = req.body;
      const userId = req.user._id;

      if (!mongoose.Types.ObjectId.isValid(assessmentId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid assessment ID format'
        });
      }

      const assessment = await AssessmentResponse.findOne({
        _id: assessmentId,
        user: userId,
        isDeleted: false
      });

      if (!assessment) {
        return res.status(404).json({
          success: false,
          message: 'Assessment not found'
        });
      }

      assessment.userNotes = notes;
      await assessment.save();

      res.json({
        success: true,
        message: 'Notes updated successfully',
        data: {
          assessmentId: assessment._id,
          userNotes: assessment.userNotes
        }
      });
    } catch (error) {
      logger.error('Update user notes error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update notes'
      });
    }
  },

  // Delete assessment soft delete because of data retention policies
  deleteAssessment: async (req, res) => {
    try {
      const { assessmentId } = req.params;
      const userId = req.user._id;

      if (!mongoose.Types.ObjectId.isValid(assessmentId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid assessment ID format'
        });
      }

      const assessment = await AssessmentResponse.findOne({
        _id: assessmentId,
        user: userId
      });

      if (!assessment) {
        return res.status(404).json({
          success: false,
          message: 'Assessment not found'
        });
      }

      // Soft delete
      assessment.isDeleted = true;
      assessment.deletedAt = new Date();
      await assessment.save();

      logger.info(`Assessment deleted: ${assessmentId} by user ${req.user.username}`);

      res.json({
        success: true,
        message: 'Assessment deleted successfully'
      });
    } catch (error) {
      logger.error('Delete assessment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete assessment'
      });
    }
  },

  // PUBLIC ENDPOINTS 
  getPublicTemplates: async (req, res) => {
    try {
      const { category } = req.query;

      const filter = {
        isPublished: true,
        isActive: true
      };

      if (category) filter.category = category;

      const templates = await AssessmentTemplate.find(filter)
        .select('name category description estimatedDuration totalResponses questionCount')
        .sort({ category: 1, name: 1 });

      res.json({
        success: true,
        message: 'Public assessment templates retrieved',
        data: {
          templates,
          count: templates.length
        }
      });
    } catch (error) {
      logger.error('Get public templates error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve assessment templates'
      });
    }
  },

  // Get single public template to begin assessment (no auth required)
  getPublicTemplateToBegin: async (req, res) => {
    try {
      const { templateId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(templateId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid template ID format'
        });
      }

      const template = await AssessmentTemplate.findOne({
        _id: templateId,
        isPublished: true,
        isActive: true
      });

      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Assessment template not found or not available'
        });
      }

      res.json({
        success: true,
        message: 'Assessment template retrieved. You can begin the assessment.',
        data: {
          template,
          message: 'You can take this assessment as a guest or login for a personalized experience and to track your progress.'
        }
      });
    } catch (error) {
      logger.error('Get public template error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve assessment template'
      });
    }
  },

  // Submit assessment for guests or authenticated users (unified endpoint)
  submitPublicAssessment: async (req, res) => {
    try {
      const { templateId, responses, shareWithCounselor, counselorId, userNotes } = req.body;
      const userId = req.user ? req.user._id : null;
      const isGuest = !userId;

      if (!mongoose.Types.ObjectId.isValid(templateId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid template ID format'
        });
      }

      // Get template
      const template = await AssessmentTemplate.findOne({
        _id: templateId,
        isActive: true,
        isPublished: true
      });

      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Assessment template not found or not available'
        });
      }

      // Calculate score
      const { totalScore, scoredResponses } = await assessmentService.calculateScore(template, responses);

      // Get severity level
      const severityLevel = template.getSeverityLevel(totalScore);

      // Detect crisis
      const { isCrisis, crisisIndicators } = await assessmentService.detectCrisis(template, responses);

      // Generate recommendations
      const recommendations = await assessmentService.generateRecommendations(
        template,
        totalScore,
        severityLevel?.name
      );

      // Create assessment response
      const assessmentData = {
        user: userId,
        template: templateId,
        templateSnapshot: {
          name: template.name,
          version: template.version,
          category: template.category
        },
        responses: scoredResponses,
        totalScore,
        severityLevel: severityLevel?.name || 'Unknown',
        isCrisis,
        crisisIndicators,
        status: 'completed',
        completedAt: new Date(),
        isAnonymous: isGuest,
        shareWithCounselor: false, // Guests cannot share initially
        userNotes,
        recommendations
      };

      // Generate session ID for guest users
      if (isGuest) {
        assessmentData.sessionId = crypto.randomBytes(16).toString('hex');
      } else {
        // For authenticated users, handle counselor sharing
        if (shareWithCounselor && counselorId && mongoose.Types.ObjectId.isValid(counselorId)) {
          const counselor = await Counselor.findById(counselorId);
          if (counselor) {
            assessmentData.shareWithCounselor = true;
            assessmentData.sharedWith = [{
              counselor: counselorId,
              sharedAt: new Date()
            }];
          }
        }
      }

      const assessment = new AssessmentResponse(assessmentData);
      await assessment.save();

      // Update template usage stats
      await AssessmentTemplate.findByIdAndUpdate(templateId, {
        $inc: { totalResponses: 1 },
        lastUsed: new Date()
      });

      // Handle follow-up actions for authenticated users
      const followUpActions = [];

      if (!isGuest) {
        // Crisis response for authenticated users
        if (isCrisis) {
          await notificationController.createNotification(
            userId,
            'assessment_crisis',
            'We\'re Here for You',
            'Thank you for completing your assessment. Your responses show you may be going through a difficult time. You don\'t have to face this alone - support is available.',
            {
              assessment: assessment._id,
              channels: ['inApp'],
              priority: 'high'
            }
          );

          // Notify counselor if shared
          if (shareWithCounselor && counselorId) {
            await notificationController.createNotification(
              counselorId,
              'assessment_crisis_shared',
              'Urgent: High-Risk Assessment Shared',
              `A user has shared a high-risk assessment with you that requires attention.`,
              {
                assessment: assessment._id,
                user: userId,
                channels: ['inApp'],
                priority: 'high'
              }
            );

            followUpActions.push({
              action: 'counselor_notified',
              performedAt: new Date(),
              details: { counselorId }
            });
          }
        }

        // Regular counselor notification (if shared)
        if (shareWithCounselor && counselorId && !isCrisis) {
          await notificationController.createNotification(
            counselorId,
            'assessment_shared',
            'New Assessment Shared',
            `A user has shared their ${template.name} assessment with you.`,
            {
              assessment: assessment._id,
              user: userId,
              channels: ['inApp']
            }
          );

          followUpActions.push({
            action: 'counselor_notified',
            performedAt: new Date(),
            details: { counselorId }
          });
        }

        // Save follow-up actions
        if (followUpActions.length > 0) {
          assessment.followUpActions = followUpActions;
          await assessment.save();
        }
      }

      logger.info(`Assessment completed: ${assessment._id} for template ${template.name} by ${isGuest ? 'guest' : 'user ' + userId}`);

      // Prepare response
      const responseData = {
        assessment: {
          id: assessment._id,
          totalScore,
          severityLevel: severityLevel?.name,
          isCrisis,
          recommendations,
          completedAt: assessment.completedAt
        }
      };

      // Add session ID for guests
      if (isGuest) {
        responseData.assessment.sessionId = assessment.sessionId;
        responseData.message = 'Assessment submitted successfully as guest. To save and track your assessments, please create an account or login.';
      } else {
        responseData.message = 'Assessment submitted successfully';
      }

      res.status(201).json({
        success: true,
        ...responseData,
        data: responseData
      });
    } catch (error) {
      logger.error('Submit public assessment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to submit assessment',
        error: error.message
      });
    }
  }
};

module.exports = assessmentController;

