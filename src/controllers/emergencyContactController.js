const EmergencyContact = require('../models/emergency');
const logger = require('../utils/logger');

class EmergencyContactController {
  async getContacts(req, res) {
    try {
      const userId = req.user._id;
      const contacts = await EmergencyContact.find({ userId })
        .sort({ priority: -1, createdAt: 1 });

      return res.json({
        success: true,
        message: 'Emergency contacts retrieved successfully',
        data: contacts
      });
    } catch (error) {
      logger.error('Get emergency contacts error:', error);
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async getActiveContacts(req, res) {
    try {
      const userId = req.user._id;
      const contacts = await EmergencyContact.getActiveContacts(userId);

      return res.json({
        success: true,
        message: 'Active emergency contacts retrieved successfully',
        data: contacts
      });
    } catch (error) {
      logger.error('Get active emergency contacts error:', error);
      return res.status(500).json({
        success: false,
        message: error.message
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
          message: 'Emergency contact not found'
        });
      }

      return res.json({
        success: true,
        message: 'Emergency contact retrieved successfully',
        data: contact
      });
    } catch (error) {
      logger.error('Get emergency contact error:', error);
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async createContact(req, res) {
    try {
      const userId = req.user._id;
      const { name, relationship, phoneNumber, email, priority, notes } = req.body;

      const existingContact = await EmergencyContact.findOne({ userId, email });
      if (existingContact) {
        return res.status(400).json({
          success: false,
          message: 'Emergency contact with this email address already exists'
        });
      }

      const contact = await EmergencyContact.create({
        userId,
        name,
        relationship: relationship || 'other',
        phoneNumber,
        email,
        priority: priority || 0,
        notes,
        consentGiven: true
      });

      return res.status(201).json({
        success: true,
        message: 'Emergency contact created successfully',
        data: contact
      });
    } catch (error) {
      logger.error('Create emergency contact error:', error);

      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors
        });
      }

      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'Emergency contact with this email address already exists'
        });
      }

      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async updateContact(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user._id;
      const updateData = req.body;

      const contact = await EmergencyContact.findOne({ _id: id, userId });

      if (!contact) {
        return res.status(404).json({
          success: false,
          message: 'Emergency contact not found'
        });
      }

      if (updateData.email && updateData.email !== contact.email) {
        const existingContact = await EmergencyContact.findOne({
          userId,
          email: updateData.email,
          _id: { $ne: id }
        });

        if (existingContact) {
          return res.status(400).json({
            success: false,
            message: 'Emergency contact with this email address already exists'
          });
        }
      }

      Object.assign(contact, updateData);
      await contact.save();

      return res.json({
        success: true,
        message: 'Emergency contact updated successfully',
        data: contact
      });
    } catch (error) {
      logger.error('Update emergency contact error:', error);

      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors
        });
      }

      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'Emergency contact with this phone number already exists'
        });
      }

      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async deleteContact(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user._id;

      const contact = await EmergencyContact.findOneAndDelete({ _id: id, userId });

      if (!contact) {
        return res.status(404).json({
          success: false,
          message: 'Emergency contact not found'
        });
      }

      return res.json({
        success: true,
        message: 'Emergency contact deleted successfully'
      });
    } catch (error) {
      logger.error('Delete emergency contact error:', error);
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async toggleConsent(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user._id;
      const { consentGiven } = req.body;

      const contact = await EmergencyContact.findOne({ _id: id, userId });

      if (!contact) {
        return res.status(404).json({
          success: false,
          message: 'Emergency contact not found'
        });
      }

      contact.consentGiven = consentGiven !== undefined ? consentGiven : !contact.consentGiven;
      await contact.save();

      return res.json({
        success: true,
        message: `Consent ${contact.consentGiven ? 'granted' : 'revoked'} successfully`,
        data: contact
      });
    } catch (error) {
      logger.error('Toggle consent error:', error);
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new EmergencyContactController();

