const express = require("express");
const router = express.Router();
const sosController = require("../controllers/sosController");
const { auth, optionalAuth } = require("../middleware/auth"); // Use existing middleware
const { validateSOSTrigger } = require("../middleware/validation.middleware");

// Public/Quick Access Routes (checks auth internally)
router.get("/check-access", optionalAuth, sosController.checkAccess);
router.post(
  "/quick-trigger",
  optionalAuth,
  validateSOSTrigger,
  sosController.quickTriggerSOS
);

// Authenticated Routes
router.post("/trigger", auth, validateSOSTrigger, sosController.triggerSOS);
router.post("/:id/cancel", auth, sosController.cancelSOS);

module.exports = router;
