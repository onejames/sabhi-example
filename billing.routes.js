const express = require('express');
const { z } = require('zod');
const billingController = require('../controllers/billing.controller');
const asyncHandler = require('../middleware/async-handler');
const validate = require('../middleware/validate');
const authRequired = require('../middleware/auth');
const requirePermissions = require('../middleware/rbac');

const router = express.Router();

router.get(
  '/billing/plans',
  asyncHandler(billingController.listPlans)
);

router.get(
  '/billing/subscription',
  authRequired,
  requirePermissions('billing.manage'),
  asyncHandler(billingController.getBillingSubscription)
);

router.get(
  '/billing',
  authRequired,
  requirePermissions('billing.manage'),
  asyncHandler(billingController.listPayments)
);

router.post(
  '/billing/request',
  authRequired,
  requirePermissions('billing.manage'),
  validate(
    z.object({
      contactId: z.string().uuid().optional(),
      invoiceId: z.string().uuid().optional(),
      amountCents: z.number().int().positive(),
      currency: z.string().length(3).default('USD'),
      provider: z.enum(['stripe', 'manual']).default('stripe'),
      metadata: z.record(z.any()).optional(),
    })
  ),
  asyncHandler(billingController.createPaymentRequest)
);

router.post(
  '/billing/checkout-session',
  authRequired,
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
  '/billing/onboarding/checkout-session',
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
  '/billing/onboarding/verify-checkout',
  validate(
    z.object({
      sessionId: z.string().min(1),
      email: z.string().email().optional(),
    })
  ),
  asyncHandler(billingController.verifyOnboardingCheckoutSession)
);

module.exports = router;