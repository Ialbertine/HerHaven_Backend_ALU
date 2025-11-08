const EmergencyContact = require("../models/emergency");
const logger = require("../utils/logger");

class EmergencyContactController {
  async getContacts(req, res) {
    try {
      const userId = req.user._id;
      const contacts = await EmergencyContact.find({ userId }).sort({
        createdAt: 1,
      });

      return res.json({
        success: true,
        message: "Emergency contacts retrieved successfully",
        data: contacts,
      });
    } catch (error) {
      logger.error("Get emergency contacts error:", error);
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getContact(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user._id;

      const contact = await EmergencyContact.findOne({ _id: id, userId });

      if (!contact) {
        return res.status(404).json({
          success: false,
          message: "Emergency contact not found",
        });
      }

      return res.json({
        success: true,
        message: "Emergency contact retrieved successfully",
        data: contact,
      });
    } catch (error) {
      logger.error("Get emergency contact error:", error);
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async createContact(req, res) {
    try {
      const userId = req.user._id;
      const { name, relationship, phoneNumber, notes } = req.body;

      // Validate phone number is provided
      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          message: "Phone number is required for emergency contacts",
        });
      }

      const contact = await EmergencyContact.create({
        userId,
        name,
        relationship: relationship || "other",
        phoneNumber,
        notes,
      });

      return res.status(201).json({
        success: true,
        message: "Emergency contact created successfully",
        data: contact,
      });
    } catch (error) {
      logger.error("Create emergency contact error:", error);

      if (error.name === "ValidationError") {
        const errors = Object.values(error.errors).map((err) => err.message);
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors,
        });
      }

      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: "Emergency contact with this phone number already exists",
        });
      }

      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async updateContact(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user._id;
      const allowedFields = ["name", "relationship", "phoneNumber", "notes"];
      const updateData = {};

      allowedFields.forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(req.body, field)) {
          updateData[field] = req.body[field];
        }
      });

      const contact = await EmergencyContact.findOne({ _id: id, userId });

      if (!contact) {
        return res.status(404).json({
          success: false,
          message: "Emergency contact not found",
        });
      }

      // Removed duplicate phone number check to allow multiple contacts with same number
      // Users may want to add multiple family members sharing the same phone number

      Object.assign(contact, updateData);
      await contact.save();

      return res.json({
        success: true,
        message: "Emergency contact updated successfully",
        data: contact,
      });
    } catch (error) {
      logger.error("Update emergency contact error:", error);

      if (error.name === "ValidationError") {
        const errors = Object.values(error.errors).map((err) => err.message);
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors,
        });
      }

      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: "Emergency contact with this phone number already exists",
        });
      }

      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async deleteContact(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user._id;

      const contact = await EmergencyContact.findOneAndDelete({
        _id: id,
        userId,
      });

      if (!contact) {
        return res.status(404).json({
          success: false,
          message: "Emergency contact not found",
        });
      }

      return res.json({
        success: true,
        message: "Emergency contact deleted successfully",
      });
    } catch (error) {
      logger.error("Delete emergency contact error:", error);
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
}

module.exports = new EmergencyContactController();
