// server.js
require('dotenv').config();

const path      = require('path');
const express   = require('express');
const http      = require('http');
const socketIo  = require('socket.io');
const session   = require('express-session');
const cookieParser = require('cookie-parser');
const { MongoClient } = require('mongodb');

const app     = express();
const server  = http.createServer(app);
const io      = socketIo(server);

const PORT     = process.env.PORT || 3000;
const MONGO_URI      = process.env.MONGO_URI;
const SESSION_SECRET = process.env.SESSION_SECRET;
const RECAPTCHA_SITE = process.env.RECAPTCHA_SITE_KEY;

// ————————————————
// Express Middleware
// ————————————————
app.use(express.json());
app.use(cookieParser());
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true }
}));
app.use(express.static(path.join(__dirname, 'public')));

// ————————————————
// Database Connection
// ————————————————
let db, usersCol, codesCol;
MongoClient.connect(MONGO_URI, { useUnifiedTopology: true })
  .then(client => {
    db         = client.db('quizduel');
    usersCol   = db.collection('users');
    codesCol   = db.collection('signupCodes');
    console.log('✅ MongoDB connected');
  })
  .catch(err => console.error('MongoDB connection error:', err));

// ————————————————
// Socket.io for reCAPTCHA key
// ————————————————
io.on('connection', socket => {
  socket.on('requestCaptchaKey', () => {
    socket.emit('captchaKey', RECAPTCHA_SITE);
  });
});

// ————————————————
// Mount Routes
// ————————————————
app.use('/',   require('./routes/pages'));
app.use('/',   require('./routes/auth')(usersCol, codesCol));  
// note: auth.js exports a function taking the two collections

// ————————————————
// Start Server
// ————————————————
server.listen(PORT, () => {
  console.log(`🚀 Listening on http://localhost:${PORT}`);
});
