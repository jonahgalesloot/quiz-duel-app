// routes/pages.js
const path = require('path');
const express = require('express');
const router = express.Router();

// Redirect root → landing
router.get('/',               (req, res) => res.redirect('/landing'));
router.get('/landing',        (req, res) => res.sendFile(path.join(__dirname, '../public/html/landing.html')));
router.get('/login',          (req, res) => res.sendFile(path.join(__dirname, '../public/html/login.html')));
router.get('/signup',         (req, res) => res.sendFile(path.join(__dirname, '../public/html/signup.html')));

// Protect dashboard route
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/landing');
  next();
}
router.get('/dashboard', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/html/dashboard.html'));
});

module.exports = router;
