const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  // Skip connection in test mode - tests handle their own connection
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error('Database connection error:', error);
    process.exit(1);
  }
};

module.exports = connectDB;