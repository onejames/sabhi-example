/**
 * Idempotency Store
 * 
 * This is a temporary in-memory store for purposes of testing. 
 * This should be replaced with something like REDDIS.
 */

class IdempotencyStore {

  constructor() {
    this.cache = new Map();
  }

  /**
   * Gets the value of a key, assuming it has not expired
   * @param {*} key 
   * @returns string value
   */
  async get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) return null;

    // The TTL check
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Sets the value of a key
   * @param {*} key 
   * @param {*} value 
   * @param {*} ttl 
   */
  async set(key, value, ttl = 86400000) {
    this.cache.set(key, { 
      value, 
      expiresAt: Date.now() + ttl 
    });
  }
}

module.exports = new IdempotencyStore();