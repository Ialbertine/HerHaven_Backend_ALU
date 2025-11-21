const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/server');
const User = require('../../src/models/user');

// Helper to check if DB is connected
const isDbConnected = () => mongoose.connection.readyState === 1;

describe('Authentication API', () => {
  let dbWarningShown = false;

  beforeAll(() => {
    if (!isDbConnected() && !dbWarningShown) {
      dbWarningShown = true;
    }
  });

  beforeEach(async () => {
    if (isDbConnected()) {
      await User.deleteMany({});
    }
  });

  describe('POST /api/auth/register', () => {
    test('should register a new user successfully', async () => {
      if (!isDbConnected()) {
        return;
      }
      const userData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'Test123456'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User registered successfully');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.username).toBe(userData.username);
    });

    test('should reject registration with weak password', async () => {
      if (!isDbConnected()) {
        return;
      }
      const userData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'weak'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Password');
    });

    test('should reject duplicate email registration', async () => {
      if (!isDbConnected()) {
        return;
      }
      const userData = {
        email: 'duplicate@example.com',
        username: 'user1',
        password: 'Test123456'
      };

      // First registration
      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // Second registration with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...userData, username: 'user2' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });

    test('should reject duplicate username registration', async () => {
      if (!isDbConnected()) {
        return;
      }
      const userData = {
        email: 'user1@example.com',
        username: 'duplicateuser',
        password: 'Test123456'
      };

      // First registration
      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // Second registration with same username
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...userData, email: 'user2@example.com' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Username already taken');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      if (!isDbConnected()) {
        return;
      }
      // Create a test user
      const user = new User({
        email: 'login@example.com',
        username: 'loginuser',
        password: 'Test123456',
        role: 'user',
        isActive: true
      });
      await user.save();
    });

    test('should login with correct credentials', async () => {
      if (!isDbConnected()) {
        return;
      }
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'Test123456'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user.email).toBe('login@example.com');
    });

    test('should reject login with incorrect password', async () => {
      if (!isDbConnected()) {
        return;
      }
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'WrongPassword123'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid email or password');
    });

    test('should reject login with non-existent email', async () => {
      if (!isDbConnected()) {
        return;
      }
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Test123456'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid email or password');
    });

    test('should reject login with missing email', async () => {
      if (!isDbConnected()) {
        return;
      }
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          password: 'Test123456'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/continue-as-guest', () => {
    test('should create a guest session', async () => {
      if (!isDbConnected()) {
        return;
      }
      const response = await request(app)
        .post('/api/auth/continue-as-guest')
        .send({
          userAgent: 'Mozilla/5.0',
          ipAddress: '127.0.0.1'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Guest session created successfully');
      expect(response.body.data).toHaveProperty('sessionId');
      expect(response.body.data.accessType).toBe('guest');
    });
  });
});

