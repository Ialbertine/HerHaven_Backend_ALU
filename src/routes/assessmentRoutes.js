const express = require("express");
const assessmentController = require("../controllers/assessmentController");
const { auth } = require("../middleware/auth");
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

// Admin routes for assessment templates
router.post("/templates", auth, requireAdmin, validate(createTemplateValidation),assessmentController.createTemplate);

// Get all assessment templates
router.get("/templates", auth, requireAnyRole, assessmentController.getTemplates);

// Get single assessment template
router.get("/templates/:templateId", auth, requireAnyRole, assessmentController.getTemplateById);

// Update assessment template (admin only)
router.put("/templates/:templateId", auth, requireAdmin, validate(updateTemplateValidation), assessmentController.updateTemplate);

// Delete assessment template (admin only)
router.delete("/templates/:templateId", auth, requireAdmin, assessmentController.deleteTemplate);

// assessment submission routes
// Submit assessment response (authenticated users)
router.post("/submit", auth, requireUser, validate(submitAssessmentValidation), assessmentController.submitAssessment);


// Submit anonymous assessment (no auth required)
router.post("/anonymous/submit", validate(submitAssessmentValidation), assessmentController.submitAnonymousAssessment);

// Get user's assessment history
router.get("/my-assessments", auth, requireUser, assessmentController.getMyAssessments);

// Get specific assessment by ID
router.get("/:assessmentId", auth, requireAnyRole, assessmentController.getAssessmentById);

// Get assessment by session ID (for anonymous users)
router.get("/session/:sessionId", assessmentController.getAssessmentBySession);

// Get assessment recommendations
router.get("/:assessmentId/recommendations", auth, requireUser, assessmentController.getRecommendations);


// self assessment analytics routes

// Get user's assessment analytics
router.get("/analytics/me", auth, requireUser, assessmentController.getAnalytics);

// Check if should retake assessment
router.get("/retake/:templateId", auth, requireUser, assessmentController.checkRetake);

// sharing and counselor interaction routes
// Share assessment with counselor
router.post("/:assessmentId/share", auth, requireUser, validate(shareAssessmentValidation),assessmentController.shareWithCounselor);

// Get assessments shared with counselor
router.get("/shared/with-me", auth, requireCounselor, assessmentController.getSharedAssessments);

// Add counselor notes to assessment
router.post("/:assessmentId/counselor-notes", auth, requireCounselor, validate(addCounselorNotesValidation), assessmentController.addCounselorNotes);

// Update user notes
router.put("/:assessmentId/notes", auth, requireUser, validate(updateUserNotesValidation), assessmentController.updateUserNotes);

// Delete assessment soft delete because of data retention policies
router.delete("/:assessmentId", auth, requireUser, assessmentController.deleteAssessment);

module.exports = router;
