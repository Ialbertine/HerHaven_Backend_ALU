const express = require('express');
const counselorController = require('../controllers/counselorController');
const { auth } = require('../middleware/auth');
const { requireCounselor } = require('../middleware/roleAuth');
const validate = require('../middleware/validation');
const { counselorRegisterValidation } = require('../validations/authValidation');

const router = express.Router();

// public routes
router.get('/allcounselors', counselorController.getAllCounselors);
router.get('/specializations/list', counselorController.getSpecializations);

// private routes
router.post('/register', validate(counselorRegisterValidation), counselorController.register);
router.get('/profile', auth, requireCounselor, counselorController.getProfile);
router.patch('/update-profile', auth, requireCounselor, counselorController.updateProfile);
router.put('/availability', auth, requireCounselor, counselorController.updateAvailability);
router.get('/pending-appointments', auth, requireCounselor, counselorController.getPendingAppointments);
router.get('/appointment-stats', auth, requireCounselor, counselorController.getAppointmentStats);

// public counselor details that will be seen by users
router.get('/:counselorId', counselorController.getCounselorById);

module.exports = router;
