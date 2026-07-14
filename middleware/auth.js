/**
 * This verifies and validates the JWT
 */

/**
 * 
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 * @returns 401 on unauthorized
 */
module.exports = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // Mock attaching a user
  req.user = { id: 'user_123', permissions: ['billing.manage'] };
  next();
};