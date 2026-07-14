/**
 * Rate Limit By Fingerprint
 * 
 * The goal here is to be able to per-route limit public access to routes that could pitenitally be abused
 */

const rateLimit = require('express-rate-limit');

/**
 * 
 * @param {*} options 
 * windowMs = Our time-based window of review
 * max = Max allowed requests to be allowed in the window
 * @returns enforcePublicSafety
 * 
 * 15(minutes) * 60 (seconds) * 1000 (milliseconds) = 900,000 ms
 * NOTE: cf-connecting-ip appears to be the correct header for cloudflare
 */
const enforcePublicSafety = (options = { windowMs: 15 * 60 * 1000, max: 10 }) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: 'Too many requests, please try again later.',
    keyGenerator: (req) => req.headers['cf-connecting-ip'] || req.ip,
    validate: { keyGeneratorIpFallback: false }
  });
};

module.exports = enforcePublicSafety;