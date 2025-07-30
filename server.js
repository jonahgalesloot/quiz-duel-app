// server.js

require('dotenv').config();
const path = require('path');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bcrypt = require('bcrypt');
const fetch = require('node-fetch');        // for reCAPTCHA server‑side verify
const session = require('express-session');
const cookieParser = require('cookie-parser');
const { MongoClient } = require('mongodb');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT           = process.env.PORT || 3000;
const MONGO_URI      = process.env.MONGO_URI;
const SESSION_SECRET = process.env.SESSION_SECRET;
const RECAPTCHA_SITE = process.env.RECAPTCHA_SITE_KEY;
const RECAPTCHA_SEC  = process.env.RECAPTCHA_SECRET_KEY;

// —————————————————————————
// Middleware
// —————————————————————————
app.use(express.json());
app.use(cookieParser());
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true /*, secure: true in prod */ }
}));

// Serve all files in /public
app.use(express.static(path.join(__dirname, 'public')));

// —————————————————————————
// MongoDB Setup
// —————————————————————————
let db, usersCol;
MongoClient.connect(MONGO_URI, { useUnifiedTopology: true })
  .then(client => {
    db = client.db('quizduel');
    usersCol = db.collection('users');
    console.log('✅ Connected to MongoDB Atlas');
  })
  .catch(err => console.error('❌ MongoDB connection error:', err));

// —————————————————————————
// Socket.io for reCAPTCHA key
// —————————————————————————
io.on('connection', socket => {
  socket.on('requestCaptchaKey', () => {
    socket.emit('captchaKey', RECAPTCHA_SITE);
  });
});

// —————————————————————————
// Helper: verify reCAPTCHA with Google
// —————————————————————————
async function verifyCaptcha(token) {
  try {
    const resp = await fetch(
      `https://www.google.com/recaptcha/api/siteverify`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${RECAPTCHA_SEC}&response=${token}`
      }
    );
    const data = await resp.json();
    return data.success;
  } catch (err) {
    console.error('Error verifying captcha:', err);
    return false;
  }
}

// —————————————————————————
// Page Routes
// —————————————————————————
// Redirect root → landing
app.get('/', (req, res) => res.redirect('/landing'));

// Serve landing, login, signup, dashboard pages
app.get('/landing',  (req, res) => res.sendFile(path.join(__dirname, 'public/html/landing.html')));
app.get('/login',    (req, res) => res.sendFile(path.join(__dirname, 'public/html/login.html')));
app.get('/signup',   (req, res) => res.sendFile(path.join(__dirname, 'public/html/signup.html')));

// Protect dashboard
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}
app.get('/dashboard', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/html/dashboard.html'));
});

// —————————————————————————
// Authentication API
// —————————————————————————

// POST /signup
app.post('/signup', async (req, res) => {
  const { username, password, recaptchaToken } = req.body;
  if (!username || !password || !recaptchaToken) {
    return res.status(400).json({ message: 'Missing fields' });
  }

  // Verify captcha
  if (!await verifyCaptcha(recaptchaToken)) {
    return res.status(400).json({ message: 'reCAPTCHA failed' });
  }

  // Check existing user
  const exists = await usersCol.findOne({ username });
  if (exists) {
    return res.status(409).json({ message: 'Username already taken' });
  }

  // Hash and store
  const hash = await bcrypt.hash(password, 10);
  await usersCol.insertOne({ username, password: hash, role: 'student' });
  return res.sendStatus(201);
});

// POST /login
app.post('/login', async (req, res) => {
  const { username, password, recaptchaToken } = req.body;
  if (!username || !password || !recaptchaToken) {
    return res.status(400).json({ message: 'Missing fields' });
  }

  // Verify captcha
  if (!await verifyCaptcha(recaptchaToken)) {
    return res.status(400).json({ message: 'reCAPTCHA failed' });
  }

  // Lookup user
  const user = await usersCol.findOne({ username });
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Compare password
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(403).json({ message: 'Incorrect password' });
  }

  // Set session
  req.session.user = { username: user.username, role: user.role };
  return res.sendStatus(200);
});

// POST /logout (optional)
app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) console.error('Session destroy error', err);
    res.clearCookie('connect.sid');
    res.sendStatus(200);
  });
});

// —————————————————————————
// Start Server
// —————————————————————————
server.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});
