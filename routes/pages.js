// routes/pages.js
const { activeMatches } = require('./socket');  // adjust path as needed

function requireMatchAccess(req, res, next) {
  const user = req.session.user && req.session.user.username;
  const { matchId } = req.params;

  // If no matchId in URL or no logged-in user, block
  if (!matchId || !user) {
    return res.redirect('/landing');
  }
  const players = activeMatches[matchId] || [];
  if (!players.includes(user)) {
    // Not one of the two players → kick back to dashboard
    return res.redirect('/dashboard');
  }
  next();
}



const path = require('path');
const express = require('express');
const router = express.Router();

// Redirect root → landing
router.get('/', (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect('/dashboard');
  } else {
    return res.redirect('/landing');
  }
});
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
router.get('/play', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/html/play.html'));
});
// Then use it on your duel route:
router.get(
  '/duel/:matchId',
  requireLogin,
  requireMatchAccess,
  (req, res) => {
    res.sendFile(path.join(__dirname, '../public/html/duel.html'));
  }
);

module.exports = router;
