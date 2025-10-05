const express = require('express');
const appointmentController = require('../controllers/appointmentController');
const { auth } = require('../middleware/auth');
const { requireUser, requireCounselor, requireAnyRole } = require('../middleware/roleAuth');
const validate = require('../middleware/validation');
const { appointmentBookingValidation } = require('../validations/appointmentValidation');

const router = express.Router();

// POST /api/appointments/book
router.post('/book', auth, requireUser, validate(appointmentBookingValidation), appointmentController.bookAppointment);

// GET /api/appointments/user
router.get('/user', auth, requireUser, appointmentController.getUserAppointments);

// GET /api/appointments/counselor
router.get('/counselor', auth, requireCounselor, appointmentController.getCounselorAppointments);

// PUT /api/appointments/:appointmentId/confirm
router.put('/:appointmentId/confirm', auth, requireCounselor, appointmentController.confirmAppointment);

// PUT /api/appointments/:appointmentId/reject
router.put('/:appointmentId/reject', auth, requireCounselor, appointmentController.rejectAppointment);

// PUT /api/appointments/:appointmentId/cancel
router.put('/:appointmentId/cancel', auth, requireUser, appointmentController.cancelAppointment);

// GET /api/appointments/:appointmentId
router.get('/:appointmentId', auth, requireUser, appointmentController.getAppointmentDetails);

// GET /api/appointments/counselor/:counselorId/availability
// Get available time slots for counselor
router.get('/counselor/:counselorId/availability', auth, requireAnyRole, appointmentController.getAvailableTimeSlots);

// GET /api/appointments/:appointmentId/meeting , access to user
// Get meeting details for appointment
router.get('/:appointmentId/meeting', auth, requireUser, appointmentController.getMeetingDetails);

// @route   PUT /api/appointments/:appointmentId/start
router.put('/:appointmentId/start', auth, requireCounselor, appointmentController.startSession);

// PUT /api/appointments/:appointmentId/end , only counselor can access
// End session (counselor)
router.put('/:appointmentId/end', auth, requireCounselor, appointmentController.endSession);

module.exports = router;
