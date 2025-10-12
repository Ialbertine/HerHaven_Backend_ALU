const Feedback = require('../models/feedback');
const logger = require('../utils/logger');
const SecurityUtils = require('../utils/security');

const feedbackController = {
  // Create feedback (authenticated or unauthenticated)
  createFeedback: async (req, res) => {
    try {
      const { fullName, email, message, rating } = req.body;
      
      // Determine if user is authenticated
      const userId = req.user ? req.user._id : undefined;
      const isAnonymous = !req.user;

      const feedbackData = {
        fullName: SecurityUtils.sanitizeUserInput(fullName),
        message: SecurityUtils.sanitizeUserInput(message),
        rating: rating || undefined,
        isAnonymous: isAnonymous,
        status: 'pending', 
        isPublic: false
      };

      // Add user ID if authenticated
      if (userId) {
        feedbackData.user = userId;
      }

      // Add email if provided
      if (email) {
        feedbackData.email = SecurityUtils.sanitizeUserInput(email);
      }

      const feedback = new Feedback(feedbackData);
      await feedback.save();

      const userIdentifier = req.user ? req.user.username : 'Anonymous User';
      logger.info(`Feedback created by: ${userIdentifier}`);

      res.status(201).json({
        success: true,
        message: 'Thank you for your feedback! It has been submitted successfully and will be reviewed.',
        data: {
          feedback: {
            id: feedback._id,
            fullName: feedback.fullName,
            message: feedback.message,
            rating: feedback.rating,
            status: feedback.status,
            isAnonymous: feedback.isAnonymous,
            createdAt: feedback.createdAt
          }
        }
      });

    } catch (error) {
      logger.error('Create feedback error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to submit feedback'
      });
    }
  },

  // Get public feedbackfor display on website
  getPublicFeedback: async (req, res) => {
    try {
      const { limit = 10, skip = 0 } = req.query;

      const feedback = await Feedback.find({
        isPublic: true,
        status: 'published'
      })
        .select('fullName message rating createdAt')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      res.json({
        success: true,
        message: 'Public feedback retrieved',
        data: {
          feedback,
          count: feedback.length
        }
      });

    } catch (error) {
      logger.error('Get public feedback error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve feedback'
      });
    }
  },

  // ADMIN: Get all feedback
  getAllFeedback: async (req, res) => {
    try {
      const { status, isAnonymous, limit = 50, skip = 0 } = req.query;

      const filter = {};
      if (status) {
        filter.status = status;
      }
      if (isAnonymous !== undefined) {
        filter.isAnonymous = isAnonymous === 'true';
      }

      const feedback = await Feedback.find(filter)
        .populate('user', 'username email')
        .populate('reviewedBy', 'username email')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      const totalCount = await Feedback.countDocuments(filter);

      res.json({
        success: true,
        message: 'All feedback retrieved',
        data: {
          feedback,
          count: feedback.length,
          total: totalCount
        }
      });

    } catch (error) {
      logger.error('Get all feedback error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve feedback'
      });
    }
  },

  // ADMIN: Get single feedback
  getFeedbackById: async (req, res) => {
    try {
      const { feedbackId } = req.params;

      const feedback = await Feedback.findById(feedbackId)
        .populate('user', 'username email')
        .populate('reviewedBy', 'username email');

      if (!feedback) {
        return res.status(404).json({
          success: false,
          message: 'Feedback not found'
        });
      }

      res.json({
        success: true,
        message: 'Feedback retrieved',
        data: { feedback }
      });

    } catch (error) {
      logger.error('Get feedback by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve feedback'
      });
    }
  },

  // ADMIN: Publish feedback (simple one-click publish)
  publishFeedback: async (req, res) => {
    try {
      const { feedbackId } = req.params;
      const admin = req.admin;

      const feedback = await Feedback.findByIdAndUpdate(
        feedbackId,
        { 
          $set: { 
            status: 'published',
            isPublic: true,
            reviewedBy: admin._id,
            reviewedAt: new Date()
          }
        },
        { new: true, runValidators: true }
      ).populate('user', 'username email');

      if (!feedback) {
        return res.status(404).json({
          success: false,
          message: 'Feedback not found'
        });
      }

      logger.info(`Feedback ${feedbackId} published by admin ${admin.email}`);

      res.json({
        success: true,
        message: 'Feedback published successfully and is now visible to public',
        data: { feedback }
      });

    } catch (error) {
      logger.error('Publish feedback error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to publish feedback'
      });
    }
  },

  // ADMIN: Unpublish feedback (remove from public view)
  unpublishFeedback: async (req, res) => {
    try {
      const { feedbackId } = req.params;
      const admin = req.admin;

      const feedback = await Feedback.findByIdAndUpdate(
        feedbackId,
        { 
          $set: { 
            status: 'reviewed',
            isPublic: false,
            reviewedBy: admin._id,
            reviewedAt: new Date()
          }
        },
        { new: true, runValidators: true }
      ).populate('user', 'username email');

      if (!feedback) {
        return res.status(404).json({
          success: false,
          message: 'Feedback not found'
        });
      }

      logger.info(`Feedback ${feedbackId} unpublished by admin ${admin.email}`);

      res.json({
        success: true,
        message: 'Feedback unpublished successfully and removed from public view',
        data: { feedback }
      });

    } catch (error) {
      logger.error('Unpublish feedback error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to unpublish feedback'
      });
    }
  },

  // ADMIN: Delete feedback
  deleteFeedback: async (req, res) => {
    try {
      const { feedbackId } = req.params;
      const admin = req.admin;

      const feedback = await Feedback.findById(feedbackId);

      if (!feedback) {
        return res.status(404).json({
          success: false,
          message: 'Feedback not found'
        });
      }

      await Feedback.deleteOne({ _id: feedbackId });

      logger.info(`Feedback ${feedbackId} deleted by admin ${admin.email}`);

      res.json({
        success: true,
        message: 'Feedback deleted successfully'
      });

    } catch (error) {
      logger.error('Delete feedback error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete feedback'
      });
    }
  },

  // ADMIN: Get feedback statistics
  getFeedbackStats: async (req, res) => {
    try {
      const totalFeedback = await Feedback.countDocuments();
      const pendingFeedback = await Feedback.countDocuments({ status: 'pending' });
      const publishedFeedback = await Feedback.countDocuments({ 
        status: 'published',
        isPublic: true 
      });
      const anonymousFeedback = await Feedback.countDocuments({ isAnonymous: true });
      const authenticatedFeedback = await Feedback.countDocuments({ isAnonymous: false });
      
      const averageRating = await Feedback.aggregate([
        { $match: { rating: { $exists: true } } },
        { $group: { _id: null, avgRating: { $avg: '$rating' } } }
      ]);

      const stats = {
        total: totalFeedback,
        pending: pendingFeedback,
        published: publishedFeedback,
        anonymous: anonymousFeedback,
        authenticated: authenticatedFeedback,
        averageRating: averageRating.length > 0 ? averageRating[0].avgRating.toFixed(2) : 0
      };

      res.json({
        success: true,
        message: 'Feedback statistics retrieved',
        data: { stats }
      });

    } catch (error) {
      logger.error('Get feedback stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve feedback statistics'
      });
    }
  }
};

module.exports = feedbackController;