/**
 * Roll Based Authorization Controll
 */

/**
 * 
 * @param {*} permission 
 * @returns 403 on unauthorized
 */
module.exports = (permission) => (req, res, next) => {
  if (!req.user || !req.user.permissions.includes(permission)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};