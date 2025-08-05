// routes/pages.js
const path    = require('path');
const express = require('express');

module.exports = function(db, getActiveMatches) {
  const router = express.Router();
  const pendingCol = db.collection('pendingSignups');

  // Middleware to protect /duel/:matchId
  function requireLogin(req, res, next) {
    if (!req.session.user) {
      console.log(`[PAGES] Require login failed, redirecting to /landing`);
      return res.redirect('/landing');
    }
    next();
  }

  function requireMatchAccess(req, res, next) {
    const user = req.session.user && req.session.user.username;
    const { matchId } = req.params;
    if (!matchId || !user) {
      console.log(`[PAGES] Deny /duel/${matchId} for user=${user}`);
      return res.redirect('/landing');
    }
    const activeMatches = getActiveMatches ? getActiveMatches() : {};
    const players = activeMatches[matchId] || [];
    if (!players.includes(user)) {
      console.warn(`[PAGES] Access denied to match ${matchId} for user ${user}. Players:`, players);
      return res.redirect('/dashboard');
    }
    console.log(`[PAGES] Access granted to /duel/${matchId} for user=${user}`);
    next();
  }

  // 1) Root → dashboard or landing
  router.get('/', (req, res) => {
    if (req.session.user) {
      console.log(`[PAGES] Redirect / → /dashboard for ${req.session.user.username}`);
      return res.redirect('/dashboard');
    }
    console.log(`[PAGES] Redirect / → /landing (not logged in)`);
    return res.redirect('/landing');
  });

  // 2) Public pages
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
    res.sendFile(path.join(__dirname, '../public/html/presignup.html'));
  });

  // 3) Verify-email page: only if token valid
  router.get('/verify-email', async (req, res) => {
    const token = req.query.token;
    if (!token) {
      console.log('[PAGES] /verify-email missing token, redirect to /landing');
      return res.redirect('/landing');
    }
    const pending = await pendingCol.findOne({ token });
    if (!pending || pending.tokenExpires < new Date()) {
      console.log('[PAGES] /verify-email invalid/expired token:', token);
      return res.redirect('/landing');
    }
    console.log('[PAGES] /verify-email valid token:', token);
    res.sendFile(path.join(__dirname, '../public/html/verify-email.html'));
  });

  // 4) Auth‐protected pages
  router.get('/dashboard', requireLogin, (req, res) => {
    console.log(`[PAGES] GET /dashboard for ${req.session.user.username}`);
    res.sendFile(path.join(__dirname, '../public/html/dashboard.html'));
  });

  router.get('/play', requireLogin, (req, res) => {
    const username = req.session.user.username;
    // If already in a match, redirect to that duel
    const activeMatches = getActiveMatches ? getActiveMatches() : {};
    for (const [id, players] of Object.entries(activeMatches)) {
      if (players.includes(username)) {
        console.log(`[PAGES] ${username} already in match ${id}, redirect to /duel/${id}`);
        return res.redirect(`/duel/${id}`);
      }
    }
    console.log(`[PAGES] GET /play for ${username}`);
    res.sendFile(path.join(__dirname, '../public/html/play.html'));
  });

  router.get(
    '/duel/:matchId',
    requireLogin,
    requireMatchAccess,
    (req, res) => {
      console.log(`[PAGES] GET /duel/${req.params.matchId} for ${req.session.user.username}`);
      res.sendFile(path.join(__dirname, '../public/html/duel.html'));
    }
  );

  router.get('/leaderboard', requireLogin, (req, res) => {
    console.log(`[PAGES] GET /leaderboard for ${req.session.user.username}`);
    res.send('<h1>Leaderboard coming soon!</h1>');
  });

  router.get('/profile', requireLogin, (req, res) => {
    console.log(`[PAGES] GET /profile for ${req.session.user.username}`);
    res.send('<h1>Profile page coming soon!</h1>');
  });

  return router;
};
