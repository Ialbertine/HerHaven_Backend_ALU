const request = require('supertest');
const app = require('../../src/server');

describe('Health Check API', () => {
  test('GET /api/health should return server status', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('message', 'HerHaven API is running');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('environment');
  });

  test('GET /api/nonexistent should return 404', async () => {
    const response = await request(app)
      .get('/api/nonexistent')
      .expect(404);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body.message).toContain('not found');
  });
});

