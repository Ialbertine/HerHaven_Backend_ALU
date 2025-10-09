const express = require('express');
const authController = require('../controllers/authController');
const validate = require('../middleware/validation');
const { registerValidation, loginValidation, guestAccessValidation } = require('../validations/authValidation');

const router = express.Router();

// POST /api/auth/register
router.post('/register', validate(registerValidation), authController.register);

// POST /api/auth/login
router.post('/login', validate(loginValidation), authController.login);
router.post('/guest', validate(guestAccessValidation), authController.continueAsGuest);
router.post('/validate-guest', authController.validateGuestSession);

module.exports = router;