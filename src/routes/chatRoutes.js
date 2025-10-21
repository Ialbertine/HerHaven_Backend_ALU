const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { optionalAuth } = require('../middleware/auth');
const validate = require('../middleware/validation');
const { chatValidation } = require('../validations/chatValidation');

// Chat endpoint - accessible with optional authentication
router.post('/chat', optionalAuth, validate(chatValidation), chatController.sendMessage);

module.exports = router;
