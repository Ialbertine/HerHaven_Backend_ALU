const express = require('express');
const contactController = require('../controllers/contactController');
const { adminAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roleAuth');
const validate = require('../middleware/validation');
const { createContactMessageValidation } = require('../validations/contactValidation');

const router = express.Router();

// Public 
router.post('/messages', validate(createContactMessageValidation), contactController.createContactMessage);

// admin managing the contacts messages
router.get('/messages', adminAuth, requireAdmin, contactController.getAllContactMessages);
router.get('/messages/:messageId', adminAuth, requireAdmin, contactController.getContactMessageById);

module.exports = router;

