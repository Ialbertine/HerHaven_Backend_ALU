const express = require("express");
const assessmentController = require("../controllers/assessmentController");
const { auth, optionalAuth } = require("../middleware/auth");
const {
  requireUser,
  requireCounselor,
  requireAdmin,
  requireAnyRole,
} = require("../middleware/roleAuth");
const validate = require("../middleware/validation");
const {
  createTemplateValidation,
  updateTemplateValidation,
  submitAssessmentValidation,
  shareAssessmentValidation,
  addCounselorNotesValidation,
  updateUserNotesValidation,
} = require("../validations/assessmentValidation");

const router = express.Router();

// Get all public assessment templates
router.get("/public/templates", assessmentController.getPublicTemplates);

// Get single public template to begin assessment (no auth required)
router.get("/public/templates/:templateId/begin", assessmentController.getPublicTemplateToBegin);

// Submit assessment (works for both guests and authenticated users)
// Uses optionalAuth to detect if user is logged in
router.post("/public/submit", optionalAuth, validate(submitAssessmentValidation), assessmentController.submitPublicAssessment);

// Get assessment by session ID (for guest users to retrieve their results)
router.get("/public/session/:sessionId", assessmentController.getAssessmentBySession);


// Admin routes for assessment templates
router.post("/templates", auth, requireAdmin, validate(createTemplateValidation), assessmentController.createTemplate);

// Get all assessment templates (authenticated)
router.get("/templates", auth, requireAnyRole, assessmentController.getTemplates);

// Get single assessment template (authenticated)
router.get("/templates/:templateId", auth, requireAnyRole, assessmentController.getTemplateById);

// Update assessment template (admin only)
router.put("/templates/:templateId", auth, requireAdmin, validate(updateTemplateValidation), assessmentController.updateTemplate);

// Delete assessment template (admin only)
router.delete("/templates/:templateId", auth, requireAdmin, assessmentController.deleteTemplate);

// Assessment submission routes (authenticated users)
// Submit assessment response (authenticated users
router.post("/submit", auth, requireUser, validate(submitAssessmentValidation), assessmentController.submitAssessment);

// Submit anonymous assessment (deprecated - use /public/submit instead)
router.post("/anonymous/submit", validate(submitAssessmentValidation), assessmentController.submitAnonymousAssessment);

// Get user's assessment history
router.get("/my-assessments", auth, requireUser, assessmentController.getMyAssessments);

// Get assessment recommendations
router.get("/results/:assessmentId/recommendations", auth, requireUser, assessmentController.getRecommendations);

// Self assessment analytics routes
// Get user's assessment analytics
router.get("/analytics/me", auth, requireUser, assessmentController.getAnalytics);

// Check if should retake assessment
router.get("/retake/:templateId", auth, requireUser, assessmentController.checkRetake);

// Sharing and counselor interaction routes
// Share assessment with counselor
router.post("/results/:assessmentId/share", auth, requireUser, validate(shareAssessmentValidation), assessmentController.shareWithCounselor);

// Get assessments shared with counselor
router.get("/shared/with-me", auth, requireCounselor, assessmentController.getSharedAssessments);

// Add counselor notes to assessment
router.post("/results/:assessmentId/counselor-notes", auth, requireCounselor, validate(addCounselorNotesValidation), assessmentController.addCounselorNotes);

// Update user notes
router.put("/results/:assessmentId/notes", auth, requireUser, validate(updateUserNotesValidation), assessmentController.updateUserNotes);

// Delete assessment (soft delete because of data retention policies)
router.delete("/results/:assessmentId", auth, requireUser, assessmentController.deleteAssessment);

module.exports = router;
