const crypto = require('crypto');

const createPayment = (attrs = {}) => {
  const paymentId = `pay_${crypto.randomBytes(8).toString('hex')}`;
  return {
    id: paymentId,
    amountCents: attrs.amountCents || 15000, 
    currency: attrs.currency || 'USD',
    status: attrs.status || 'succeeded',
    provider: attrs.provider || 'stripe',
    paymentMethod: attrs.paymentMethod || 'card',
    createdAt: new Date().toISOString(),
    metadata: attrs.metadata || { item: 'Hollander engine assembly' }
  };
};

const getExamplePayments = () => [
  createPayment({ amountCents: 45000, metadata: { item: 'CCC Pinnacle Transmission' } }),
  createPayment({ amountCents: 12500, metadata: { item: 'Hollander Wheel Rim' } }),
  createPayment({ amountCents: 95000, provider: 'manual', metadata: { item: 'CCC Engine Assembly' } })
];

module.exports = { createPayment, getExamplePayments };
