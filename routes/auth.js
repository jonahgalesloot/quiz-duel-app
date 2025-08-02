// routes/auth.js
const express = require('express');
const bcrypt  = require('bcrypt');
const fetch   = require('node-fetch').default;
const crypto  = require('crypto');
const path    = require('path');
const sendMail = require('../utils/email');

module.exports = function(usersCol, codesCol, db) {
  const router = express.Router();

  // Helper: send verification email, now accepts req
  async function sendVerificationEmail(req, email, token) {
    // Build URL dynamically from the incoming request
    const protocol = req.protocol;        // "http" or "https"
    const host     = req.get('host');     // "yourapp.com" or "localhost:3000"
    const baseUrl  = `${protocol}://${host}`;
    const link     = `${baseUrl}/verify-email?token=${token}`;

    // Send via your email utility
    await sendMail({
      to: email,
      subject: "Quizzard Email Verification",
      html: `<p>Click <a href="${link}">here</a> to complete your signup.</p>`
    });
  }

  // POST /presignup
  router.post('/presignup', async (req, res) => {
    try {
      const { email, signupCode } = req.body;
      if (!email || !signupCode) {
        return res.status(400).json({ message: 'Missing fields' });
      }
      // Validate signup code
      const valid = await codesCol.findOne({ code: signupCode });
      if (!valid) {
        return res.status(403).json({ message: 'Invalid signup code' });
      }
      // Ensure not already registered
      const exists = await usersCol.findOne({ email });
      if (exists) {
        return res.status(409).json({ message: 'Email already registered' });
      }
      // Clean up any previous pending signups
      await db.collection('pendingSignups').deleteMany({ email });

      // Create a new token entry
      const token = crypto.randomBytes(20).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await db.collection('pendingSignups').insertOne({
        email,
        signupCode,
        token,
        tokenExpires: expiresAt
      });

      // Send the verification email, passing req
      await sendVerificationEmail(req, email, token);

      return res.status(200).json({ message: 'Check your email for the verification link' });
    } catch (err) {
      console.error('[AUTH] presignup error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  });

  // GET /verify-email (serve the form to set password)
  router.get('/verify-email', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/html/verify-email.html'));
  });

  // POST /verify-email (complete signup)
  router.post('/verify-email', async (req, res) => {
    try {
      const { token, password, confirmPassword } = req.body;
      if (!token || !password || !confirmPassword) {
        return res.status(400).json({ message: 'Missing fields' });
      }
      if (password !== confirmPassword) {
        return res.status(400).json({ message: 'Passwords do not match' });
      }
      // Enforce a password policy
      if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        return res.status(400).json({
          message: 'Password must be at least 8 characters and include a letter and a number.'
        });
      }

      // Look up the pending signup
      const pending = await db.collection('pendingSignups').findOne({ token });
      if (!pending || pending.tokenExpires < new Date()) {
        return res.status(400).json({ message: 'Invalid or expired token' });
      }

      // Hash and create the new user
      const hash = await bcrypt.hash(password, 10);
      const email = pending.email;
      const username = email.split('@')[0];  // optional, or derive differently

      await usersCol.insertOne({
        email,
        username,
        password: hash,
        role: 'student',
        elo: 1200,
        playSettings: {}
      });

      // Consume the signup code and pending entry
      await codesCol.deleteOne({ code: pending.signupCode });
      await db.collection('pendingSignups').deleteOne({ token });

      return res.sendStatus(201);
    } catch (err) {
      console.error('[AUTH] verify-email error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  });

  // Login handler (by email + password)
  router.post('/login', async (req, res) => {
    try {
      const { email, password, recaptchaToken, remember } = req.body;
      if (!email || !password || !recaptchaToken) {
        return res.status(400).json({ message: 'Missing fields' });
      }
      // TODO: reCAPTCHA check here

      const user = await usersCol.findOne({ email });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      if (!await bcrypt.compare(password, user.password)) {
        return res.status(403).json({ message: 'Incorrect password' });
      }

      // Configure cookie persistence
      if (remember === 'on') {
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
      } else {
        req.session.cookie.expires = false; // session-only
      }

      // Save session user info
      req.session.user = {
        email: user.email,
        username: user.username,
        role: user.role
      };
      console.log(`[AUTH] Login: ${user.email}`);

      return res.sendStatus(200);
    } catch (err) {
      console.error('[AUTH] Login error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  });

  // Logout handler
  router.post('/logout', (req, res) => {
    const email = req.session.user && req.session.user.email;
    req.session.destroy(err => {
      res.clearCookie('connect.sid');
      console.log(`[AUTH] Logout: ${email}`);
      return res.sendStatus(200);
    });
  });

  return router;
};
