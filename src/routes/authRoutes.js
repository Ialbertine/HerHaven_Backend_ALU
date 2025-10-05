const express = require('express');
const authController = require('../controllers/authController');
const validate = require('../middleware/validation');
const { registerValidation, loginValidation, guestAccessValidation } = require('../validations/authValidation');

const router = express.Router();

// POST /api/auth/register
router.post('/register', validate(registerValidation), authController.register);

// POST /api/auth/login
router.post('/login', validate(loginValidation), authController.login);

// POST /api/auth/guest
// Continue as guest (anonymous access)
router.post('/guest', validate(guestAccessValidation), authController.continueAsGuest);

// POST /api/auth/validate-guest
router.post('/validate-guest', authController.validateGuestSession);

// POST /api/auth/admin/login
router.post('/admin/login', validate(loginValidation), authController.adminLogin);

module.exports = router;