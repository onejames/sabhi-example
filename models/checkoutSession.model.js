const crypto = require('crypto');

const createCheckoutSession = (data = {}) => {
  const sessionId = `cs_${crypto.randomBytes(12).toString('hex')}`;
  const baseUrl = data.onboarding 
    ? 'https://checkout.stripe.com/onboarding' 
    : 'https://checkout.stripe.com/pay';
  
  return {
    id: sessionId,
    priceId: data.priceId || 'price_growth',
    email: data.email || null,
    url: `${baseUrl}/${sessionId}`,
    successPath: data.successPath || '/billing/success',
    cancelPath: data.cancelPath || '/billing/cancel',
    createdAt: new Date().toISOString()
  };
};

module.exports = { createCheckoutSession };
