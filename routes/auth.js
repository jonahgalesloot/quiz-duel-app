// routes/auth.js
const express = require('express');
const bcrypt  = require('bcrypt');
const fetch = require('node-fetch').default;

module.exports = function(usersCol, codesCol) {
  const router = express.Router();

  // Helper: verify reCAPTCHA
  async function verifyCaptcha(token) {
    const secret = process.env.RECAPTCHA_SECRET_KEY;
    const resp = await fetch(
      `https://www.google.com/recaptcha/api/siteverify`,
      { method:'POST',
        headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
        body:`secret=${secret}&response=${token}` 
      }
    );
    const json = await resp.json();
    return json.success;
  }

  // Helper: password policy
  function isValidPassword(pw) {
    // At least 8 chars, 1 letter, 1 number
    return typeof pw === 'string' &&
      pw.length >= 8 &&
      /[A-Za-z]/.test(pw) &&
      /\d/.test(pw);
  }

  // Signup handler
  router.post('/signup', async (req, res) => {
    try {
      const { username, password, confirmPassword, signupCode, recaptchaToken } = req.body;
      if (!username || !password || !confirmPassword || !signupCode || !recaptchaToken) {
        return res.status(400).json({ message: 'Missing fields' });
      }
      if (password !== confirmPassword) {
        return res.status(400).json({ message: 'Passwords do not match' });
      }
      if (!isValidPassword(password)) {
        return res.status(400).json({ message: 'Password must be at least 8 characters and include a letter and a number.' });
      }
      if (!await verifyCaptcha(recaptchaToken)) {
        return res.status(400).json({ message: 'reCAPTCHA failed' });
      }
      const codeDoc = await codesCol.findOne({ code: signupCode });
      if (!codeDoc) {
        return res.status(403).json({ message: 'Invalid signup code' });
      }
      const exists = await usersCol.findOne({ username });
      if (exists) {
        return res.status(409).json({ message: 'Username taken' });
      }
      // consume code
      await codesCol.deleteOne({ code: signupCode });
      const hash = await bcrypt.hash(password, 10);
      await usersCol.insertOne({ username, password: hash, role: 'student' });
      return res.sendStatus(201);
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  });

  // Login handler
  router.post('/login', async (req, res) => {
    try {
      const { username, password, recaptchaToken, remember } = req.body;
      if (!username || !password || !recaptchaToken) {
        return res.status(400).json({ message: 'Missing fields' });
      }
      if (!await verifyCaptcha(recaptchaToken)) {
        return res.status(400).json({ message: 'reCAPTCHA failed' });
      }
      const user = await usersCol.findOne({ username });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      if (!await bcrypt.compare(password, user.password)) {
        return res.status(403).json({ message: 'Incorrect password' });
      }

      // ── HERE: configure session cookie based on the checkbox ──
      if (remember === 'on') {
        // persist for 30 days
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
      } else {
        // session-only cookie (expires when browser/tab closes)
        req.session.cookie.expires = false;
      }

      // set the logged-in user
      req.session.user = { username: user.username, role: user.role };
      return res.sendStatus(200);
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  });


  // Logout handler
  router.post('/logout', (req, res) => {
    req.session.destroy(err => {
      res.clearCookie('connect.sid');
      res.sendStatus(200);
    });
  });

  return router;
};
