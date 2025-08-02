// server.js
require('dotenv').config();
const path          = require('path');
const express       = require('express');
const http          = require('http');
const socketIo      = require('socket.io');
const session       = require('express-session');
const MongoStore    = require('connect-mongo');
const cookieParser  = require('cookie-parser');
const { MongoClient } = require('mongodb');
const sharedsession = require("express-socket.io-session");

const app     = express();
const server  = http.createServer(app);
const io      = socketIo(server);

const PORT           = process.env.PORT || 3000;
const MONGO_URI      = process.env.MONGO_URI;
const SESSION_SECRET = process.env.SESSION_SECRET;
const RECAPTCHA_SITE = process.env.RECAPTCHA_SITE_KEY;

// ————— Middleware —————
app.use(express.json());
app.use(cookieParser());
const sessionMiddleware = session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true },
  store: MongoStore.create({
    mongoUrl: MONGO_URI,
    dbName: 'quizzard',
    collectionName: 'sessions',
    ttl: 24 * 60 * 60  // 1 day in seconds
  })
});

// 2) Tell Express to use it
app.use(sessionMiddleware);

// 3) Tell Socket.io to share the same sessions
io.use(
  sharedsession(sessionMiddleware, {
    autoSave: true  // any changes on socket.handshake.session get written back
  })
);
app.use(express.static(path.join(__dirname, 'public')));

// ————— Socket.io for reCAPTCHA key —————
io.on('connection', socket => {
  socket.on('requestCaptchaKey', () => {
    socket.emit('captchaKey', RECAPTCHA_SITE);
  });
});

// ————— Connect to MongoDB & Mount Routes —————
MongoClient.connect(MONGO_URI)
  .then(client => {
    console.log('✅ Connected to MongoDB');
    const db       = client.db('quizzard');
    const usersCol = db.collection('users');
    const codesCol = db.collection('codes');

    // Serve HTML pages
    const pagesRouter = require('./routes/pages');
    app.use('/', pagesRouter);

    // Auth routes (login/signup/logout)
    const authRouter = require('./routes/auth')(usersCol, codesCol);
    app.use('/', authRouter);

    // Question‐sets API
    const questionSetsRouter = require('./routes/api/questionSets')(db);
    app.use('/api/questionSets', questionSetsRouter);

    // User info API (username + elo)
    const userRouter = require('./routes/api/user')(usersCol);
    app.use('/api/user', userRouter);

    // Play settings (stored on user.playSettings)
    const playSettingsRouter = require('./routes/playSettings')(usersCol);
    app.use('/', playSettingsRouter);

    // Socket.io matchmaking, chat, etc.
    require('./routes/socket')(io, db, usersCol);

    // Start server only after all routes are mounted
    server.listen(PORT, () => {
      console.log(`🚀 Server listening on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
  });
