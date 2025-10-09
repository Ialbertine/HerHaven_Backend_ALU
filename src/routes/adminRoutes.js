const express = require('express');
const adminController = require('../controllers/adminController');
const { adminAuth } = require('../middleware/auth');
const { requireCounselorApproval } = require('../middleware/roleAuth');
const validate = require('../middleware/validation');
const { adminOnboardValidation } = require('../validations/authValidation');

const router = express.Router();

router.use(adminAuth);

// will onboard counselor
router.post('/counselors/onboard', requireCounselorApproval, validate(adminOnboardValidation), adminController.onboardCounselor);

// will get pending counselors
router.get('/counselors', adminController.getAllCounselors);
router.get('/counselors/pending', requireCounselorApproval, adminController.getPendingCounselors);
router.put('/counselors/:counselorId/approve', requireCounselorApproval, adminController.approveCounselor);
router.put('/counselors/:counselorId/reject', requireCounselorApproval, adminController.rejectCounselor);
router.put('/counselors/:counselorId/deactivate', adminController.deactivateCounselor);
router.delete('/counselors/:counselorId', requireCounselorApproval, adminController.deleteCounselor);

// will get all platform stats
router.get('/stats', adminController.getPlatformStats);
router.get('/dashboard', adminController.getDashboardOverview);

module.exports = router;
