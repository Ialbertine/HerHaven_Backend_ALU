const express = require('express');
const counselorController = require('../controllers/counselorController');
const { auth } = require('../middleware/auth');
const { requireCounselor, requireAnyRole } = require('../middleware/roleAuth');
const validate = require('../middleware/validation');
const { counselorRegisterValidation } = require('../validations/authValidation');

const router = express.Router();

// POST /api/counselor/register 
// Register new counselor (pending admin approval)
router.post('/register', validate(counselorRegisterValidation), counselorController.register);

// GET /api/counselor/profile
router.get('/profile', auth, requireCounselor, counselorController.getProfile);

// PUT /api/counselor/availability
router.put('/availability', auth, requireCounselor, counselorController.updateAvailability);

// GET /api/counselor/browse
router.get('/browse', auth, requireAnyRole, counselorController.getAllCounselors);

// GET /api/counselor/:counselorId
router.get('/:counselorId', auth, requireAnyRole, counselorController.getCounselorById);

// GET /api/counselor/specializations/list
router.get('/specializations/list', auth, requireAnyRole, counselorController.getSpecializations);

// GET /api/counselor/pending-appointments
router.get('/pending-appointments', auth, requireCounselor, counselorController.getPendingAppointments);

// GET /api/counselor/appointment-stats
router.get('/appointment-stats', auth, requireCounselor, counselorController.getAppointmentStats);

module.exports = router;
