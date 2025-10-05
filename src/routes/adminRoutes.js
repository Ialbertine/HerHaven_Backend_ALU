const express = require('express');
const adminController = require('../controllers/adminController');
const { adminAuth } = require('../middleware/auth');
const { requireCounselorApproval } = require('../middleware/roleAuth');
const validate = require('../middleware/validation');
const { adminOnboardValidation } = require('../validations/authValidation');

const router = express.Router();

// POST /api/admin/counselors/onboard
router.post('/counselors/onboard', adminAuth, requireCounselorApproval, validate(adminOnboardValidation), adminController.onboardCounselor);

// GET /api/admin/counselors/pending
router.get('/counselors/pending', adminAuth, requireCounselorApproval, adminController.getPendingCounselors);

// PUT /api/admin/counselors/:counselorId/approve
router.put('/counselors/:counselorId/approve', adminAuth, requireCounselorApproval, adminController.approveCounselor);

// PUT /api/admin/counselors/:counselorId/reject
router.put('/counselors/:counselorId/reject', adminAuth, requireCounselorApproval, adminController.rejectCounselor);

// GET /api/admin/counselors
router.get('/counselors', adminAuth, adminController.getAllCounselors);

// PUT /api/admin/counselors/:counselorId/deactivate
router.put('/counselors/:counselorId/deactivate', adminAuth, adminController.deactivateCounselor);

// GET /api/admin/stats
router.get('/stats', adminAuth, adminController.getPlatformStats);

// GET /api/admin/dashboard
router.get('/dashboard', adminAuth, adminController.getDashboardOverview);

module.exports = router;
