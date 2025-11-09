const express = require("express");
const adminController = require("../controllers/adminController");
const { adminAuth } = require("../middleware/auth");
const { requireCounselorApproval } = require("../middleware/roleAuth");
const validate = require("../middleware/validation");
const {
  adminInviteValidation,
  completeCounselorRegistrationValidation,
} = require("../validations/authValidation");

const router = express.Router();

// Counselor completes registration publicly via token
router.post(
  "/counselors/complete-registration/:token",
  validate(completeCounselorRegistrationValidation),
  adminController.completeCounselorRegistration
);

router.use(adminAuth);

// will invite counselor
router.post(
  "/counselors/invite",
  requireCounselorApproval,
  validate(adminInviteValidation),
  adminController.inviteCounselor
);

// will get pending counselors
router.get("/counselors", adminController.getAllCounselors);
router.get(
  "/counselors/pending",
  requireCounselorApproval,
  adminController.getPendingCounselors
);
router.put(
  "/counselors/:counselorId/approve",
  requireCounselorApproval,
  adminController.approveCounselor
);
router.put(
  "/counselors/:counselorId/reject",
  requireCounselorApproval,
  adminController.rejectCounselor
);
router.put(
  "/counselors/:counselorId/deactivate",
  adminController.deactivateCounselor
);
router.delete(
  "/counselors/:counselorId",
  requireCounselorApproval,
  adminController.deleteCounselor
);

// user management
router.get("/users", adminController.getAllUsers);
router.get("/users/:userId", adminController.getUserById);
router.post("/users", adminController.createUser);
router.put("/users/:userId", adminController.updateUser);
router.delete("/users/:userId", adminController.deleteUser);

// will get all platform stats
router.get("/stats", adminController.getPlatformStats);
router.get("/dashboard", adminController.getDashboardOverview);

// Analytics endpoints
router.get("/analytics/summary", adminController.getThreeMonthSummary);
router.get("/analytics/users", adminController.getUsersHistoricalData);
router.get(
  "/analytics/counselors",
  adminController.getCounselorsHistoricalData
);
router.get(
  "/analytics/appointments",
  adminController.getAppointmentsHistoricalData
);

module.exports = router;
