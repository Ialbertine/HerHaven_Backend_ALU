const express = require('express');
const appointmentController = require('../controllers/appointmentController');
const { auth } = require('../middleware/auth');
const { requireUser, requireCounselor, requireAnyRole } = require('../middleware/roleAuth');
const validate = require('../middleware/validation');
const { appointmentBookingValidation } = require('../validations/appointmentValidation');

const router = express.Router();

// will book appointment
router.post('/book', auth, requireUser, validate(appointmentBookingValidation), appointmentController.bookAppointment);

// will get user appointments
router.get('/user', auth, requireUser, appointmentController.getUserAppointments);

// will get counselor appointments
router.get('/counselor', auth, requireCounselor, appointmentController.getCounselorAppointments);
router.put('/:appointmentId/confirm', auth, requireCounselor, appointmentController.confirmAppointment);
router.put('/:appointmentId/reject', auth, requireCounselor, appointmentController.rejectAppointment);
router.put('/:appointmentId/cancel', auth, requireUser, appointmentController.cancelAppointment);

router.get('/:appointmentId', auth, requireUser, appointmentController.getAppointmentDetails);
router.get('/counselor/:counselorId/availability', auth, requireAnyRole, appointmentController.getAvailableTimeSlots);
router.get('/:appointmentId/meeting', auth, requireUser, appointmentController.getMeetingDetails);
router.put('/:appointmentId/start', auth, requireCounselor, appointmentController.startSession);
router.put('/:appointmentId/end', auth, requireCounselor, appointmentController.endSession);

module.exports = router;
