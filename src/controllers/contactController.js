const ContactMessage = require('../models/contactMessage');
const logger = require('../utils/logger');
const SecurityUtils = require('../utils/security');

const sanitize = (value) => SecurityUtils.sanitizeUserInput(value);

const contactController = {
  createContactMessage: async (req, res) => {
    try {
      const { firstName, lastName, email, phoneNumber, message } = req.body;

      const contactMessage = new ContactMessage({
        firstName: sanitize(firstName),
        lastName: sanitize(lastName),
        email: sanitize(email),
        phoneNumber: sanitize(phoneNumber),
        message: sanitize(message),
        status: 'new',
      });

      await contactMessage.save();

      logger.info(`New contact message received from ${email}`);

      res.status(201).json({
        success: true,
        message: 'Your message has been received. Our team will reach out soon.',
        data: {
          contactMessage: {
            id: contactMessage._id,
            firstName: contactMessage.firstName,
            lastName: contactMessage.lastName,
            message: contactMessage.message,
            createdAt: contactMessage.createdAt,
          },
        },
      });
    } catch (error) {
      logger.error('Create contact message error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to submit contact message',
      });
    }
  },

  getAllContactMessages: async (req, res) => {
    try {
      const {
        status,
        search,
        page = 1,
        limit = 20,
        sortField = 'createdAt',
        sortOrder = 'desc',
      } = req.query;

      const filter = {};

      if (status) {
        filter.status = status;
      }

      if (search) {
        const searchRegex = new RegExp(search, 'i');
        filter.$or = [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
          { phoneNumber: searchRegex },
          { message: searchRegex },
        ];
      }

      const sort = {
        [sortField]: sortOrder === 'asc' ? 1 : -1,
      };

      const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
      const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
      const skip = (pageNumber - 1) * limitNumber;

      const [messages, total] = await Promise.all([
        ContactMessage.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limitNumber),
        ContactMessage.countDocuments(filter),
      ]);

      res.json({
        success: true,
        message: 'Contact messages retrieved successfully',
        data: {
          messages,
          pagination: {
            page: pageNumber,
            limit: limitNumber,
            total,
            pages: Math.ceil(total / limitNumber),
          },
        },
      });
    } catch (error) {
      logger.error('Get all contact messages error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve contact messages',
      });
    }
  },

  getContactMessageById: async (req, res) => {
    try {
      const { messageId } = req.params;

      const contactMessage = await ContactMessage.findById(messageId);

      if (!contactMessage) {
        return res.status(404).json({
          success: false,
          message: 'Contact message not found',
        });
      }

      res.json({
        success: true,
        message: 'Contact message retrieved successfully',
        data: { contactMessage },
      });
    } catch (error) {
      logger.error('Get contact message by id error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve contact message',
      });
    }
  },
};

module.exports = contactController;

