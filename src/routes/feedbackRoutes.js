const express = require('express');
const feedbackController = require('../controllers/feedbackController');
const { adminAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roleAuth');
const validate = require('../middleware/validation');
const { createFeedbackValidation } = require('../validations/feedbackValidation');

const router = express.Router();

// Public routes 
router.post('/create', validate(createFeedbackValidation), feedbackController.createFeedback);
router.get('/all', feedbackController.getPublicFeedback);

// Admin routes
router.get('/all-feedback', adminAuth, requireAdmin, feedbackController.getAllFeedback);
router.get('/stats', adminAuth, requireAdmin, feedbackController.getFeedbackStats);
router.get('/:feedbackId', adminAuth, requireAdmin, feedbackController.getFeedbackById);
router.patch('/:feedbackId/publish', adminAuth, requireAdmin, feedbackController.publishFeedback);
router.patch('/:feedbackId/unpublish', adminAuth, requireAdmin, feedbackController.unpublishFeedback);
router.delete('/:feedbackId', adminAuth, requireAdmin, feedbackController.deleteFeedback);

module.exports = router;