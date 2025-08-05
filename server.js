require('dotenv').config();
const path          = require('path');
const express       = require('express');
const http          = require('http');
const session       = require('express-session');
const MongoStore    = require('connect-mongo');
const cookieParser  = require('cookie-parser');
const { MongoClient } = require('mongodb');
const sharedsession = require("express-socket.io-session");

const app     = express();
const server  = http.createServer(app);         // <-- Create server FIRST
const io      = require('socket.io')(server); 

const PORT           = process.env.PORT || 3000;
const MONGO_URI      = process.env.MONGO_URI;
const SESSION_SECRET = process.env.SESSION_SECRET;
const RECAPTCHA_SITE = process.env.RECAPTCHA_SITE_KEY;

// Helper function to get local IP for LAN access
function getLocalIP() {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

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

    // Socket.io matchmaking, chat, etc.
    const socketModule = require('./routes/socket')(io, db, usersCol);

    // Serve HTML pages
    const pagesRouter = require('./routes/pages')(db, socketModule.activeMatches);
    app.use('/', pagesRouter);

    // Auth routes (login/signup/logout)
    const authRouter = require('./routes/auth')(usersCol, codesCol, db);
    app.use('/', authRouter);

    // Auth API routes
    const avatarUpload = require('./routes/api/auth/avatar-upload')(usersCol);
    app.use('/', avatarUpload);

    const avatarDownload = require('./routes/api/auth/avatar-download')(usersCol);
    app.use('/', avatarDownload);

    const userRouter = require('./routes/api/auth/user')(usersCol);
    app.use('/', userRouter);

    // Game API routes
    const questionSetsRouter = require('./routes/api/game/questionSets')(db);
    app.use('/', questionSetsRouter);

    const gameQuestionsRouter = require('./routes/api/game/questions')(db);
    app.use('/', gameQuestionsRouter);

    const aiGradeRouter = require('./routes/api/game/ai-grade');
    app.use('/', aiGradeRouter);

    // Settings API routes
    const playSettingsRouter = require('./routes/api/settings/playSettings')(usersCol);
    app.use('/', playSettingsRouter);

    // Start server only after all routes are mounted
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server listening on http://localhost:${PORT}`);
      console.log(`🌐 LAN Access: http://${getLocalIP()}:${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
  });
