const express = require('express');
const bcrypt  = require('bcrypt');
const fetch = require('node-fetch').default;
const crypto = require('crypto');
const path = require('path');
const sendMail = require('../utils/email');

module.exports = function(usersCol, codesCol, db) {
  const router = express.Router();

  // Helper: send verification email
  async function sendVerificationEmail(email, token) {
    const link = `${process.env.BASE_URL || 'http://localhost:3000'}/verify-email?token=${token}`;
    await sendMail({
      to: email,
      subject: "QuizDuel Email Verification",
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
      const valid = await codesCol.findOne({ code: signupCode });
      if (!valid) return res.status(403).json({ message: 'Invalid signup code' });

      // Check if already registered
      const exists = await usersCol.findOne({ email });
      if (exists) return res.status(409).json({ message: 'Email already registered' });

      // Remove any previous pending signup for this email
      await db.collection('pendingSignups').deleteMany({ email });

      // Generate token
      const token = crypto.randomBytes(20).toString('hex');
      const now   = new Date();
      await db.collection('pendingSignups').insertOne({
        email, signupCode, token,
        tokenExpires: new Date(now.getTime() + 1000 * 60 * 60) // 1hr
      });

      await sendVerificationEmail(email, token);

      return res.status(200).json({ message: 'Check your email for the verification link' });
    } catch (err) {
      console.log('[AUTH] presignup error:', err);
      res.status(500).json({ message: 'Server error' });
    }
  });

  // GET /verify-email (serve the HTML)
  router.get('/verify-email', (req, res) =>
    res.sendFile(path.join(__dirname, '../public/html/verify-email.html'))
  );

  // POST /verify-email
  router.post('/verify-email', async (req, res) => {
    try {
      const { token, password, confirmPassword } = req.body;
      if (!token || !password || !confirmPassword) {
        return res.status(400).json({ message: 'Missing fields' });
      }
      if (password !== confirmPassword) {
        return res.status(400).json({ message: 'Passwords do not match' });
      }
      // Password policy
      if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        return res.status(400).json({ message: 'Password must be at least 8 characters and include a letter and a number.' });
      }
      // Find pending signup
      const pending = await db.collection('pendingSignups').findOne({ token });
      if (!pending || pending.tokenExpires < new Date()) {
        return res.status(400).json({ message: 'Invalid or expired token' });
      }
      // Create user
      const hash = await bcrypt.hash(password, 10);
      const email = pending.email;
      const username = email.split('@')[0];
      await usersCol.insertOne({
        email,
        username,
        password: hash,
        role: 'student',
        elo: 1200,
        playSettings: {}
      });
      // Consume code & pending doc
      await codesCol.deleteOne({ code: pending.signupCode });
      await db.collection('pendingSignups').deleteOne({ token });

      return res.sendStatus(201);
    } catch (err) {
      console.log('[AUTH] verify-email error:', err);
      res.status(500).json({ message: 'Server error' });
    }
  });

  // Login handler (now by email)
  router.post('/login', async (req, res) => {
    try {
      const { email, password, recaptchaToken, remember } = req.body;
      if (!email || !password || !recaptchaToken) {
        return res.status(400).json({ message: 'Missing fields' });
      }
      // ...reCAPTCHA check as before...
      const user = await usersCol.findOne({ email });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      if (!await bcrypt.compare(password, user.password)) {
        return res.status(403).json({ message: 'Incorrect password' });
      }
      if (remember === 'on') {
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
      } else {
        req.session.cookie.expires = false;
      }
      req.session.user = { email: user.email, username: user.username, role: user.role };
      console.log(`[AUTH] Login: ${user.email}`);
      return res.sendStatus(200);
    } catch (err) {
      console.log(`[AUTH] Login error:`, err);
      res.status(500).json({ message: 'Server error' });
    }
  });

 // Logout handler
  router.post('/logout', (req, res) => {
    const username = req.session.user && req.session.user.username;
    req.session.destroy(err => {
      res.clearCookie('connect.sid');
      console.log(`[AUTH] Logout: ${username}`);
      res.sendStatus(200);
    });
  });

  return router;
};