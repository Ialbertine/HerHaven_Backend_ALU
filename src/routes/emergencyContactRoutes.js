const express = require('express');
const router = express.Router();
const emergencyContactController = require('../controllers/emergencyContactController');
const { auth } = require('../middleware/auth');

// All routes require authentication
router.use(auth);

// Get all contacts
router.get('/', emergencyContactController.getContacts);

// Get single contact
router.get('/:id', emergencyContactController.getContact);

// Create contact
router.post('/', emergencyContactController.createContact);

// Update contact
router.put('/:id', emergencyContactController.updateContact);

// Delete contact
router.delete('/:id', emergencyContactController.deleteContact);

module.exports = router;

