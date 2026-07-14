const plans = [
  {
    id: 'starter',
    name: 'Sabhi Starter',
    description: 'Essential payment tools for small auto recyclers.',
    priceCents: 4900,
    currency: 'USD',
    interval: 'month'
  },
  {
    id: 'growth',
    name: 'Sabhi Growth',
    description: 'Advanced invoicing, PayBuddy checkout, and return management.',
    priceCents: 14900,
    currency: 'USD',
    interval: 'month'
  },
  {
    id: 'pro',
    name: 'Sabhi Pro',
    description: 'Sabhi Score AI fraud detection, pinnacle integration, and priority support.',
    priceCents: 29900,
    currency: 'USD',
    interval: 'month'
  }
];

module.exports = {
  list: () => plans,
  getKeys: () => plans.map(p => p.id)
};
