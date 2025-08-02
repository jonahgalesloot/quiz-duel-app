// routes/pages.js
const { activeMatches } = require('./socket');  // adjust path as needed

function requireMatchAccess(req, res, next) {
  const user = req.session.user && req.session.user.username;
  const { matchId } = req.params;
  if (!matchId || !user) {
    console.log(`[PAGES] Deny access to /duel/${matchId} for user=${user} (not logged in or no matchId)`);
    return res.redirect('/landing');
  }
  const players = activeMatches[matchId] || [];
  if (!players.includes(user)) {
    console.warn(`[PAGES] Access denied to match ${matchId} for user ${user}. Players in match:`, players);
    return res.redirect('/dashboard');
  }
  console.log(`[PAGES] Access granted to /duel/${matchId} for user=${user}`);
  next();
}

const path = require('path');
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  if (req.session && req.session.user) {
    console.log(`[PAGES] Redirect / to /dashboard for user=${req.session.user.username}`);
    return res.redirect('/dashboard');
  } else {
    console.log(`[PAGES] Redirect / to /landing (not logged in)`);
    return res.redirect('/landing');
  }
});
router.get('/landing', (req, res) => {
  console.log(`[PAGES] GET /landing`);
  res.sendFile(path.join(__dirname, '../public/html/landing.html'));
});
router.get('/login', (req, res) => {
  console.log(`[PAGES] GET /login`);
  res.sendFile(path.join(__dirname, '../public/html/login.html'));
});
router.get('/signup', (req, res) => {
  console.log(`[PAGES] GET /signup`);
  res.sendFile(path.join(__dirname, '../public/html/signup.html'));
});

function requireLogin(req, res, next) {
  if (!req.session.user) {
    console.log(`[PAGES] Require login failed, redirecting to /landing`);
    return res.redirect('/landing');
  }
  next();
}

router.get('/dashboard', requireLogin, (req, res) => {
  console.log(`[PAGES] GET /dashboard for user=${req.session.user.username}`);
  res.sendFile(path.join(__dirname, '../public/html/dashboard.html'));
});
router.get('/play', requireLogin, (req, res) => {
  const username = req.session.user.username;
  // Check if user is in any active match
  let matchId = null;
  for (const [id, players] of Object.entries(activeMatches)) {
    if (players.includes(username)) {
      matchId = id;
      break;
    }
  }
  if (matchId) {
    console.log(`[PAGES] User ${username} is already in match ${matchId}, redirecting to /duel/${matchId}`);
    return res.redirect(`/duel/${matchId}`);
  }
  console.log(`[PAGES] GET /play for user=${username}`);
  res.sendFile(path.join(__dirname, '../public/html/play.html'));
});
router.get(
  '/duel/:matchId',
  requireLogin,
  requireMatchAccess,
  (req, res) => {
    console.log(`[PAGES] GET /duel/${req.params.matchId} for user=${req.session.user.username}`);
    res.sendFile(path.join(__dirname, '../public/html/duel.html'));
  }
);

router.get('/leaderboard', requireLogin, (req, res) => {
  console.log(`[PAGES] GET /leaderboard for user=${req.session.user.username}`);
  res.send('<h1>Leaderboard coming soon!</h1>');
});
router.get('/profile', requireLogin, (req, res) => {
  console.log(`[PAGES] GET /profile for user=${req.session.user.username}`);
  res.send('<h1>Profile page coming soon!</h1>');
});

module.exports = router;
