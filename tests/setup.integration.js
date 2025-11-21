// Integration test setup file - requires database
process.env.NODE_ENV = 'test';

require('dotenv').config({ quiet: true });

const mongoose = require('mongoose');

// Use a separate test database
const TEST_MONGODB_URI = process.env.MONGO_URI_TEST ||
  (process.env.MONGO_URI ? process.env.MONGO_URI.replace(/\/[^/]+$/, '/herhaven_test') : 'mongodb://localhost:27017/herhaven_test');

process.env.MONGO_URI = TEST_MONGODB_URI;

// Connect to test database before all tests
beforeAll(async () => {
  try {
    // Close any existing connections first
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }

    await mongoose.connect(TEST_MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
  } catch (error) {
    if (!process.env.DB_CONNECTION_WARNED) {
      process.env.DB_CONNECTION_WARNED = 'true';
    }
  }
}, 10000);

// Clean up database after each test
afterEach(async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      const collections = mongoose.connection.collections;
      for (const key in collections) {
        await collections[key].deleteMany({});
      }
    }
  } catch (error) {
    // Ignore cleanup errors
  }
});

// Close database connection after all tests
afterAll(async () => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
    }
  } catch (error) {
    // Ignore cleanup errors
  }
}, 10000);

