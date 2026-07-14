const crypto = require('crypto');

const createSubscription = (userId, planId = 'growth') => {
  const subscriptionId = `sub_${crypto.randomBytes(8).toString('hex')}`;
  const now = new Date();
  const nextMonth = new Date();
  nextMonth.setMonth(now.getMonth() + 1);

  return {
    id: subscriptionId,
    userId: userId || 'user_123',
    planId: planId,
    status: 'active',
    currentPeriodStart: now.toISOString(),
    currentPeriodEnd: nextMonth.toISOString(),
    cancelAtPeriodEnd: false,
    paymentMethod: {
      brand: 'visa',
      last4: '4242'
    },
    sabhiScoreEnabled: planId === 'pro'
  };
};

module.exports = { createSubscription };
