const crypto = require('crypto');

const createPaymentRequest = (data = {}) => {
  const requestId = `req_${crypto.randomBytes(8).toString('hex')}`;
  return {
    id: requestId,
    contactId: data.contactId || crypto.randomUUID(),
    invoiceId: data.invoiceId || crypto.randomUUID(),
    amountCents: data.amountCents || 50000,
    currency: data.currency || 'USD',
    provider: data.provider || 'stripe',
    status: 'request_created',
    url: `https://yourpaybuddy.com/pay/${requestId}`,
    createdAt: new Date().toISOString(),
    metadata: data.metadata || {}
  };
};

module.exports = { createPaymentRequest };
