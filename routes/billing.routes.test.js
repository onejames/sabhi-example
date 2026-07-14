const request = require('supertest');

// Mock auth middleware before requiring app to allow testing the Forbidden (403) case
jest.mock('../middleware/auth', () => (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (token === 'Bearer no-permissions') {
    req.user = { id: 'user_no_perms', permissions: [] };
  } else {
    req.user = { id: 'user_123', permissions: ['billing.manage'] };
  }
  next();
});

const app = require('../app');
const store = require('../utils/idempotencyStore');
const rateLimitByFingerprint = require('../middleware/rateLimitByFingerprint');

describe('Billing API', () => {
  beforeEach(() => {
    // Clear idempotency cache before each test to maintain isolation
    store.cache.clear();
  });

  describe('GET /billing/plans', () => {
    it('should list plans', async () => {
      const res = await request(app).get('/billing/plans');
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /billing/subscription', () => {
    it('should return 401 when unauthenticated', async () => {
      const res = await request(app).get('/billing/subscription');
      expect(res.statusCode).toBe(401);
    });

    it('should return 403 when user lacks permissions', async () => {
      const res = await request(app)
        .get('/billing/subscription')
        .set('Authorization', 'Bearer no-permissions');
      expect(res.statusCode).toBe(403);
    });

    it('should return 200 when authenticated', async () => {
      const res = await request(app)
        .get('/billing/subscription')
        .set('Authorization', 'Bearer token123');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('subscription');
    });
  });

  describe('GET /billing', () => {
    it('should return 401 when unauthenticated', async () => {
      const res = await request(app).get('/billing');
      expect(res.statusCode).toBe(401);
    });

    it('should return 200 when authenticated', async () => {
      const res = await request(app)
        .get('/billing')
        .set('Authorization', 'Bearer token123');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('payments');
    });
  });

  describe('POST /billing/request', () => {
    it('should return 401 when unauthenticated', async () => {
      const res = await request(app).post('/billing/request').send({});
      expect(res.statusCode).toBe(401);
    });

    it('should return 400 when body validation fails', async () => {
      const res = await request(app)
        .post('/billing/request')
        .set('Authorization', 'Bearer token123')
        .send({
          amountCents: -50, // Negative cents not allowed by schema
        });
      expect(res.statusCode).toBe(400);
    });

    it('should return 201 when valid request is sent', async () => {
      const res = await request(app)
        .post('/billing/request')
        .set('Authorization', 'Bearer token123')
        .send({
          amountCents: 1000,
          currency: 'USD',
          provider: 'stripe',
        });
      expect(res.statusCode).toBe(201);
      expect(res.body.status).toBe('request_created');
    });
  });

  describe('POST /billing/checkout-session', () => {
    it('should return 401 when unauthenticated', async () => {
      const res = await request(app)
        .post('/billing/checkout-session')
        .send({});
      expect(res.statusCode).toBe(401);
    });

    it('should return 400 when idempotency-key header is missing', async () => {
      const res = await request(app)
        .post('/billing/checkout-session')
        .set('Authorization', 'Bearer token123')
        .send({ priceId: 'price_abc' });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('Idempotency-Key');
    });

    it('should return 400 when validation fails', async () => {
      const res = await request(app)
        .post('/billing/checkout-session')
        .set('Authorization', 'Bearer token123')
        .set('Idempotency-Key', 'key-1')
        .send({ priceId: '' }); // empty string not allowed by schema
      expect(res.statusCode).toBe(400);
    });

    it('should process request and catch duplicate calls', async () => {
      const payload = { priceId: 'price_abc' };
      const idempotencyKey = 'key-checkout-1';

      // First call
      const res1 = await request(app)
        .post('/billing/checkout-session')
        .set('Authorization', 'Bearer token123')
        .set('Idempotency-Key', idempotencyKey)
        .send(payload);
      expect(res1.statusCode).toBe(201);
      expect(res1.body).toHaveProperty('url');

      // Second call (duplicate)
      const res2 = await request(app)
        .post('/billing/checkout-session')
        .set('Authorization', 'Bearer token123')
        .set('Idempotency-Key', idempotencyKey)
        .send(payload);
      expect(res2.statusCode).toBe(200);
      expect(res2.body.status).toBe('already_processed');
    });

    it('should return 409 when a request is in progress', async () => {
      await store.set('key-in-progress', 'PROCESSING');
      const res = await request(app)
        .post('/billing/checkout-session')
        .set('Authorization', 'Bearer token123')
        .set('Idempotency-Key', 'key-in-progress')
        .send({ priceId: 'price_abc' });
      expect(res.statusCode).toBe(409);
      expect(res.body.error).toContain('Request in progress');
    });

    it('should return cached response data if present in store', async () => {
      const cachedResponse = { url: 'https://checkout.stripe.com/cached-url' };
      await store.set('key-cached', cachedResponse);
      const res = await request(app)
        .post('/billing/checkout-session')
        .set('Authorization', 'Bearer token123')
        .set('Idempotency-Key', 'key-cached')
        .send({ priceId: 'price_abc' });
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(cachedResponse);
    });

    it('should not overwrite cache if controller sets custom value during request', async () => {
      const origStoreSet = store.set;
      const idempotencyKey = 'key-custom-during-req';
      const customResponse = { url: 'https://checkout.stripe.com/custom-data' };
      
      // Override store.set to simulate the controller writing custom data during request
      store.set = async (key, value, ttl) => {
        await origStoreSet.call(store, key, value, ttl);
        if (key === idempotencyKey && value === 'PROCESSING') {
          await origStoreSet.call(store, key, customResponse, ttl);
        }
      };

      await request(app)
        .post('/billing/checkout-session')
        .set('Authorization', 'Bearer token123')
        .set('Idempotency-Key', idempotencyKey)
        .send({ priceId: 'price_abc' });

      const finalVal = await store.get(idempotencyKey);
      expect(finalVal).toEqual(customResponse);

      // Restore original store.set method
      store.set = origStoreSet;
    });
  });

  describe('POST /billing/onboarding/checkout-session', () => {
    it('should return 400 when idempotency key is missing', async () => {
      const res = await request(app)
        .post('/billing/onboarding/checkout-session')
        .send({ priceId: 'price_abc', email: 'test@example.com' });
      expect(res.statusCode).toBe(400);
    });

    it('should process request and handle idempotency', async () => {
      const payload = { priceId: 'price_abc', email: 'test@example.com' };
      const idempotencyKey = 'key-onboarding-1';

      // First call
      const res1 = await request(app)
        .post('/billing/onboarding/checkout-session')
        .set('Idempotency-Key', idempotencyKey)
        .send(payload);
      expect(res1.statusCode).toBe(201);
      expect(res1.body).toHaveProperty('url');

      // Second call (duplicate)
      const res2 = await request(app)
        .post('/billing/onboarding/checkout-session')
        .set('Idempotency-Key', idempotencyKey)
        .send(payload);
      expect(res2.statusCode).toBe(200);
      expect(res2.body.status).toBe('already_processed');
    });
  });

  describe('POST /billing/onboarding/verify-checkout', () => {
    it('should verify checkout and support idempotency', async () => {
      const payload = { sessionId: 'session_abc' };
      const idempotencyKey = 'key-verify-1';

      // First call
      const res1 = await request(app)
        .post('/billing/onboarding/verify-checkout')
        .set('Idempotency-Key', idempotencyKey)
        .send(payload);
      expect(res1.statusCode).toBe(200);
      expect(res1.body.verified).toBe(true);

      // Second call (duplicate)
      const res2 = await request(app)
        .post('/billing/onboarding/verify-checkout')
        .set('Idempotency-Key', idempotencyKey)
        .send(payload);
      expect(res2.statusCode).toBe(200);
      expect(res2.body.status).toBe('already_processed');
    });
  });

  describe('Rate Limit Middleware Default Parameters', () => {
    it('should handle rateLimitByFingerprint default options', () => {
      const limiter = rateLimitByFingerprint();
      expect(limiter).toBeDefined();
    });
  });

  describe('Idempotency Store Expiration', () => {
    it('should expire and remove keys after TTL has passed', async () => {
      const key = 'key-expired';
      await store.set(key, 'FINISHED', -1000); // negative TTL is already expired
      const val = await store.get(key);
      expect(val).toBeNull();
      expect(store.cache.has(key)).toBe(false);
    });
  });
});