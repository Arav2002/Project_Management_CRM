const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' }
});

router.post('/login', loginLimiter, (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  if (!process.env.ADMIN_PASSWORD_HASH) {
    return res.status(500).json({ error: 'Server is not configured yet: run "npm run hash-password" and set ADMIN_PASSWORD_HASH in .env' });
  }

  const hashedInput = crypto.createHash('sha256').update(password).digest('hex');

  if (email !== process.env.ADMIN_EMAIL || hashedInput !== process.env.ADMIN_PASSWORD_HASH) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, email });
});

module.exports = router;
