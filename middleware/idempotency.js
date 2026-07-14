/**
 * Idempotency
 * 
 * The interntion here is to use a quick low-overhead storage to check for the unique key, i would use reddis.
 * This is currently being mocked in a temporary in-memory store.
 */

const store = require('../utils/idempotencyStore');

/**
 * Validates that the idempotency-key is both passed in the header, but is infact valid.
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 * @returns 
 */
const idempotencyMiddleware = async (req, res, next) => {
  const key = req.headers['idempotency-key'];
  if (!key) {
    return res.status(400).json({ error: 'Idempotency-Key header is required for this operation' });
  }

  /**
   * If the key exists than we have processed this request before.
   */
  const value = await store.get(key);

  if (value === 'PROCESSING') {
    return res.status(409).json({ error: 'Request in progress' });
  }

  if (value === 'FINISHED') {
    return res.status(200).json({ status: 'already_processed' });
  }

  // If the controller previously cached data under this key, return it
  if (value && value !== 'FAILED') {
    return res.status(200).json(value);
  }

  // Set the "in-flight" lock
  await store.set(key, 'PROCESSING');
  
  res.on('finish', async () => {
    const currentValue = await store.get(key);
    // Only update if the controller didn't write its own cached value
    if (currentValue === 'PROCESSING') {
      if (res.statusCode === 200 || res.statusCode === 201) {
        await store.set(key, 'FINISHED');
      } else {
        await store.set(key, 'FAILED');
      }

      // This is assuming that if there is data - that has not expired - that is not PROCESSING or FINISHED 
      // then its intentional data for this client response
      return value;
    }
  });

  next();
};

module.exports = idempotencyMiddleware