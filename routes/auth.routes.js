const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const userStore = require('../utils/userStore');

const JWT_SECRET = 'your-secret-key-123'; // Simple static secret key

// Call /user-init -> returns a username/password that is stored in memory
router.post('/user-init', (req, res) => {
  const { username, password } = req.body;
  
  const finalUsername = username || `user_${Math.floor(Math.random() * 10000)}`;
  const finalPassword = password || `pass_${Math.floor(Math.random() * 10000)}`;

  userStore.set(finalUsername, finalPassword, ['billing.manage']);

  res.status(201).json({
    username: finalUsername,
    password: finalPassword,
    permissions: ['billing.manage']
  });
});

const tokenBlacklist = require('../utils/tokenBlacklist');

// Call /login -> returns a JWT
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = userStore.get(username);
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const payload = {
    username: username,
    permissions: user.permissions
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

  res.status(200).json({
    token: `Bearer ${token}`
  });
});

// Call /logout -> returns a message and blacklists JWT
router.post('/logout', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(400).json({ error: 'Missing or malformed Authorization header' });
  }

  const token = authHeader.split(' ')[1];
  tokenBlacklist.add(token);

  res.status(200).json({ message: 'Logged out successfully' });
});

module.exports = router;
