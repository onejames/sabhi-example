const planModel = require('../models/plan.model');
const subscriptionModel = require('../models/subscription.model');
const paymentModel = require('../models/payment.model');
const paymentRequestModel = require('../models/paymentRequest.model');
const checkoutSessionModel = require('../models/checkoutSession.model');

module.exports = {
  listPlans: async (req, res) => {
    res.status(200).json(planModel.list());
  },

  getBillingSubscription: async (req, res) => {
    const userId = req.user ? req.user.id : 'user_123';
    const sub = subscriptionModel.createSubscription(userId, 'growth');
    res.status(200).json({ subscription: sub });
  },

  listPayments: async (req, res) => {
    res.status(200).json({ payments: paymentModel.getExamplePayments() });
  },

  createPaymentRequest: async (req, res) => {
    const requestData = paymentRequestModel.createPaymentRequest(req.body);
    res.status(201).json(requestData);
  },

  createSubscriptionCheckoutSession: async (req, res) => {
    const session = checkoutSessionModel.createCheckoutSession({
      priceId: req.body.priceId,
      successPath: req.body.successPath,
      cancelPath: req.body.cancelPath,
      onboarding: false
    });
    res.status(201).json(session);
  },

  createOnboardingCheckoutSession: async (req, res) => {
    const session = checkoutSessionModel.createCheckoutSession({
      priceId: req.body.priceId,
      email: req.body.email,
      successPath: req.body.successPath,
      cancelPath: req.body.cancelPath,
      onboarding: true
    });
    res.status(201).json(session);
  },

  verifyOnboardingCheckoutSession: async (req, res) => {
    const planKey = req.body.planKey || 'growth';
    res.status(200).json({
      verified: true,
      sessionId: req.body.sessionId,
      plan: planKey,
      verifiedAt: new Date().toISOString()
    });
  }
};