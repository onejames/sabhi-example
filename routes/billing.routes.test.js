const request = require('supertest');
const app = require('../app'); // No server started, just the express instance

describe('Billing API', () => {
  it('should list plans', async () => {
    const res = await request(app).get('/billing/plans');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});