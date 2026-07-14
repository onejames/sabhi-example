const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const userStore = require('../utils/userStore');
const tokenBlacklist = require('../utils/tokenBlacklist');

describe('Auth API and JWT Verification', () => {
  beforeEach(() => {
    userStore.clear();
    tokenBlacklist.clear();
  });

  describe('POST /auth/user-init', () => {
    it('should initialize a test user with auto-generated credentials', async () => {
      const res = await request(app).post('/auth/user-init').send({});
      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('username');
      expect(res.body).toHaveProperty('password');
      expect(res.body.permissions).toContain('billing.manage');
      
      const stored = userStore.get(res.body.username);
      expect(stored).toBeDefined();
      expect(stored.password).toBe(res.body.password);
    });

    it('should initialize a test user with custom credentials', async () => {
      const res = await request(app)
        .post('/auth/user-init')
        .send({ username: 'customUser', password: 'customPassword' });
      expect(res.statusCode).toBe(201);
      expect(res.body.username).toBe('customUser');
      expect(res.body.password).toBe('customPassword');
    });
  });

  describe('POST /auth/login', () => {
    it('should return 400 if username or password is missing', async () => {
      const res1 = await request(app).post('/auth/login').send({ username: 'user1' });
      expect(res1.statusCode).toBe(400);

      const res2 = await request(app).post('/auth/login').send({ password: 'pwd' });
      expect(res2.statusCode).toBe(400);
    });

    it('should return 401 for invalid credentials', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ username: 'nonexistent', password: 'pwd' });
      expect(res.statusCode).toBe(401);
    });

    it('should return 200 with JWT token for valid credentials', async () => {
      // First create the user
      await request(app)
        .post('/auth/user-init')
        .send({ username: 'validUser', password: 'validPassword' });

      // Then log in
      const res = await request(app)
        .post('/auth/login')
        .send({ username: 'validUser', password: 'validPassword' });
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.token).toContain('Bearer ');
    });
  });

  describe('POST /auth/logout', () => {
    it('should return 400 if Authorization header is missing', async () => {
      const res = await request(app).post('/auth/logout').send({});
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('Authorization');
    });

    it('should successfully blacklist the token and return 200', async () => {
      await request(app)
        .post('/auth/user-init')
        .send({ username: 'logoutuser', password: 'password123' });

      const loginRes = await request(app)
        .post('/auth/login')
        .send({ username: 'logoutuser', password: 'password123' });
      const token = loginRes.body.token;

      // Logout
      const logoutRes = await request(app)
        .post('/auth/logout')
        .set('Authorization', token)
        .send({});
      expect(logoutRes.statusCode).toBe(200);
      expect(logoutRes.body.message).toBe('Logged out successfully');

      // Subsequent request using same token should be blocked
      const res = await request(app)
        .get('/billing/subscription')
        .set('Authorization', token);
      expect(res.statusCode).toBe(401);
      expect(res.body.error).toContain('blacklisted');
    });
  });

  describe('Stateless JWT Authorization on Billing Routes', () => {
    it('should block requests with missing authorization headers', async () => {
      const res = await request(app).get('/billing/subscription');
      expect(res.statusCode).toBe(401);
    });

    it('should block requests with malformed tokens', async () => {
      const res = await request(app)
        .get('/billing/subscription')
        .set('Authorization', 'InvalidTokenStructure');
      expect(res.statusCode).toBe(401);
    });

    it('should block requests with invalid JWT signatures', async () => {
      const res = await request(app)
        .get('/billing/subscription')
        .set('Authorization', 'Bearer invalid.token.signature');
      expect(res.statusCode).toBe(401);
    });

    it('should allow requests with a valid signed JWT', async () => {
      // 1. Create a user
      await request(app)
        .post('/auth/user-init')
        .send({ username: 'authorizedUser', password: 'password123' });

      // 2. Login to get JWT
      const loginRes = await request(app)
        .post('/auth/login')
        .send({ username: 'authorizedUser', password: 'password123' });
      const token = loginRes.body.token;

      // 3. Request billing subscription using the token (calls the real, unmocked auth.js middleware)
      const res = await request(app)
        .get('/billing/subscription')
        .set('Authorization', token);
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('subscription');
    });

    it('should handle JWT payload with no permissions claim', async () => {
      const token = jwt.sign({ username: 'no-perms-user' }, 'your-secret-key-123');
      const res = await request(app)
        .get('/billing/subscription')
        .set('Authorization', `Bearer ${token}`);
      expect(res.statusCode).toBe(403);
    });
  });

  describe('User Store Unit Checks', () => {
    it('should support default permissions list on user initialization', () => {
      userStore.set('default-user', 'some-pass'); // omitting third argument
      const user = userStore.get('default-user');
      expect(user.permissions).toEqual(['billing.manage']);
    });
  });

  describe('Token Blacklist Store Unit Tests', () => {
    it('should add, check, and clear token blacklist store', () => {
      tokenBlacklist.add('my-token');
      expect(tokenBlacklist.has('my-token')).toBe(true);
      tokenBlacklist.clear();
      expect(tokenBlacklist.has('my-token')).toBe(false);
    });
  });
});
