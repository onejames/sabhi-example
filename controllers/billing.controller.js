module.exports = {
  listPlans: async (req, res) => {
    res.status(200).json( ['starter', 'growth', 'pro'] );
  },

  getBillingSubscription: async (req, res) => {
    res.status(200).json({ subscription: { id: 'sub_123', status: 'active' } });
  },

  listPayments: async (req, res) => {
    res.status(200).json({ payments: [] });
  },

  createPaymentRequest: async (req, res) => {
    res.status(201).json({ status: 'request_created', id: 'req_abc' });
  },

  createSubscriptionCheckoutSession: async (req, res) => {
    res.status(201).json({ url: 'https://checkout.stripe.com/pay/abc' });
  },

  createOnboardingCheckoutSession: async (req, res) => {
    res.status(201).json({ url: 'https://checkout.stripe.com/onboarding/abc' });
  },

  verifyOnboardingCheckoutSession: async (req, res) => {
    res.status(200).json({ verified: true, plan: 'growth' });
  }
};