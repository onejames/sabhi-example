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
      const payload = { sessionId: 'session_abc', planKey: 'starter' };
      const idempotencyKey = 'key-verify-1';

      // First call
      const res1 = await request(app)
        .post('/billing/onboarding/verify-checkout')
        .set('Idempotency-Key', idempotencyKey)
        .send(payload);
      expect(res1.statusCode).toBe(200);
      expect(res1.body.verified).toBe(true);
      expect(res1.body.plan).toBe('starter');

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

  describe('Model Unit Tests', () => {
    const planModel = require('../models/plan.model');
    const subscriptionModel = require('../models/subscription.model');
    const paymentModel = require('../models/payment.model');
    const paymentRequestModel = require('../models/paymentRequest.model');
    const checkoutSessionModel = require('../models/checkoutSession.model');

    it('should test plan model helpers', () => {
      expect(planModel.getKeys()).toEqual(['starter', 'growth', 'pro']);
    });

    it('should test subscription model with fallbacks and custom plans', () => {
      const sub = subscriptionModel.createSubscription(null, 'pro');
      expect(sub.userId).toBe('user_123');
      expect(sub.sabhiScoreEnabled).toBe(true);
    });

    it('should test subscription model default plan fallback', () => {
      const sub = subscriptionModel.createSubscription('some-user');
      expect(sub.planId).toBe('growth');
      expect(sub.sabhiScoreEnabled).toBe(false);
    });

    it('should test payment model custom attributes', () => {
      const pay = paymentModel.createPayment({
        amountCents: 20000,
        currency: 'EUR',
        status: 'failed',
        provider: 'manual',
        paymentMethod: 'bank',
        metadata: { info: 'payout' }
      });
      expect(pay.amountCents).toBe(20000);
      expect(pay.currency).toBe('EUR');
      expect(pay.status).toBe('failed');
      expect(pay.provider).toBe('manual');
      expect(pay.paymentMethod).toBe('bank');
      expect(pay.metadata).toEqual({ info: 'payout' });
    });

    it('should test payment model default parameters', () => {
      const pay = paymentModel.createPayment();
      expect(pay.amountCents).toBe(15000);
      expect(pay.currency).toBe('USD');
      expect(pay.status).toBe('succeeded');
      expect(pay.provider).toBe('stripe');
      expect(pay.paymentMethod).toBe('card');
      expect(pay.metadata).toHaveProperty('item');
    });

    it('should test paymentRequest model custom attributes', () => {
      const reqData = paymentRequestModel.createPaymentRequest({
        contactId: 'contact-uuid-123',
        invoiceId: 'invoice-uuid-456',
        amountCents: 300,
        currency: 'GBP',
        provider: 'manual',
        metadata: { notes: 'manual billing' }
      });
      expect(reqData.contactId).toBe('contact-uuid-123');
      expect(reqData.invoiceId).toBe('invoice-uuid-456');
      expect(reqData.amountCents).toBe(300);
      expect(reqData.currency).toBe('GBP');
      expect(reqData.provider).toBe('manual');
      expect(reqData.metadata).toEqual({ notes: 'manual billing' });
    });

    it('should test paymentRequest model default parameters', () => {
      const reqData = paymentRequestModel.createPaymentRequest();
      expect(reqData.amountCents).toBe(50000);
      expect(reqData.currency).toBe('USD');
      expect(reqData.provider).toBe('stripe');
    });

    it('should test checkoutSession model onboarding and custom paths', () => {
      const session = checkoutSessionModel.createCheckoutSession({
        priceId: 'price_pro',
        email: 'user@paybuddy.com',
        successPath: '/success',
        cancelPath: '/cancel',
        onboarding: true
      });
      expect(session.priceId).toBe('price_pro');
      expect(session.email).toBe('user@paybuddy.com');
      expect(session.successPath).toBe('/success');
      expect(session.cancelPath).toBe('/cancel');
      expect(session.url).toContain('https://checkout.stripe.com/onboarding');
    });

    it('should test checkoutSession model default parameters', () => {
      const session = checkoutSessionModel.createCheckoutSession();
      expect(session.priceId).toBe('price_growth');
      expect(session.email).toBeNull();
      expect(session.url).toContain('https://checkout.stripe.com/pay');
    });
  });

  describe('Controller Unit Tests', () => {
    const billingController = require('../controllers/billing.controller');

    const mockRes = () => {
      const res = {};
      res.status = jest.fn().mockReturnValue(res);
      res.json = jest.fn().mockReturnValue(res);
      return res;
    };

    it('should test getBillingSubscription with no user context', async () => {
      const res = mockRes();
      await billingController.getBillingSubscription({}, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should test createPaymentRequest with default parameters', async () => {
      const res = mockRes();
      await billingController.createPaymentRequest({ body: {} }, res);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should test createSubscriptionCheckoutSession with default parameters', async () => {
      const res = mockRes();
      await billingController.createSubscriptionCheckoutSession({ body: {} }, res);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should test createOnboardingCheckoutSession with default parameters', async () => {
      const res = mockRes();
      await billingController.createOnboardingCheckoutSession({ body: {} }, res);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should test verifyOnboardingCheckoutSession with default parameters', async () => {
      const res = mockRes();
      await billingController.verifyOnboardingCheckoutSession({ body: {} }, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});