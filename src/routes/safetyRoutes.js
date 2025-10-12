const express = require('express');
const safetyController = require('../controllers/safetyController');
const { quickExitCheck, securityHeaders } = require('../middleware/safety');

const router = express.Router();

// Apply security headers to all safety routes
router.use(securityHeaders);

// GET /api/safety/quick-exit redirect to safe website 
router.get('/quick-exit', quickExitCheck, safetyController.quickExit);

// GET /api/safety/info public access
router.get('/info', safetyController.safetyCheck);

module.exports = router;