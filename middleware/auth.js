const jwt = require('jsonwebtoken');
const tokenBlacklist = require('../utils/tokenBlacklist');

const JWT_SECRET = 'your-secret-key-123'; // Must match secret in auth.routes.js

module.exports = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or malformed token' });
  }

  const token = authHeader.split(' ')[1];

  if (tokenBlacklist.has(token)) {
    return res.status(401).json({ error: 'Unauthorized: Token is blacklisted / logged out' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Attach the verified user details to the request object
    req.user = {
      id: decoded.username,
      permissions: decoded.permissions || []
    };
    
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};