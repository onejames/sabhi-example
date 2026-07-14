/**
 * Billing routes
 */

const express = require('express');
const router = express.Router();

const { z } = require('zod');

const asyncHandler = require('../middleware/async-handler');
const validate = require('../middleware/validate');
const authRequired = require('../middleware/auth');
const requirePermissions = require('../middleware/rbac');
const idempotencyMiddleware = require('../middleware/idempotency');
const rateLimitByFingerprint = require('../middleware/rateLimitByFingerprint');

const billingController = require('../controllers/billing.controller');

const { CURRENCY_KEYS } = require('../constants/currency');

router.get(
  '/plans',
  asyncHandler(billingController.listPlans)
);

router.get(
  '/subscription',
  authRequired,
  requirePermissions('billing.manage'),
  asyncHandler(billingController.getBillingSubscription)
);

router.get(
  '/',
  authRequired,
  requirePermissions('billing.manage'),
  asyncHandler(billingController.listPayments)
);

router.post(
  '/request',
  authRequired,
  requirePermissions('billing.manage'),
  validate(
    z.object({
      contactId: z.string().uuid().optional(),
      invoiceId: z.string().uuid().optional(),
      amountCents: z.number().int().positive(),
      currency: z.enum(CURRENCY_KEYS).default('USD'),
      provider: z.enum(['stripe', 'manual']).default('stripe'),
      metadata: z.record(z.any()).optional(),
    })
  ),
  asyncHandler(billingController.createPaymentRequest)
);

router.post(
  '/checkout-session',
  authRequired,
  idempotencyMiddleware,
  validate(
    z.object({
      priceId: z.string().min(1),
      successPath: z.string().min(1).optional(),
      cancelPath: z.string().min(1).optional(),
    })
  ),
  asyncHandler(billingController.createSubscriptionCheckoutSession)
);

router.post(
  '/onboarding/checkout-session',
  rateLimitByFingerprint({ max: 5 }),
  idempotencyMiddleware,
  validate(
    z.object({
      priceId: z.string().min(1),
      email: z.string().email(),
      planKey: z.enum(['starter', 'growth', 'pro']).optional(),
      successPath: z.string().min(1).optional(),
      cancelPath: z.string().min(1).optional(),
    })
  ),
  asyncHandler(billingController.createOnboardingCheckoutSession)
);

router.post(
  '/onboarding/verify-checkout',
  rateLimitByFingerprint({ max: 10 }),
  idempotencyMiddleware,
  validate(
    z.object({
      sessionId: z.string().min(1),
      email: z.string().email().optional(),
    })
  ),
  asyncHandler(billingController.verifyOnboardingCheckoutSession)
);

module.exports = router;