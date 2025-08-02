// server.js
require('dotenv').config();
const path          = require('path');
const express       = require('express');
const http          = require('http');
const socketIo      = require('socket.io');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cookieParser  = require('cookie-parser');
const { MongoClient } = require('mongodb');

const app     = express();
const server  = http.createServer(app);
const io      = socketIo(server);

const PORT            = process.env.PORT || 3000;
const MONGO_URI       = process.env.MONGO_URI;
const SESSION_SECRET  = process.env.SESSION_SECRET;
const RECAPTCHA_SITE  = process.env.RECAPTCHA_SITE_KEY;

// ————— Middleware —————
app.use(express.json());
app.use(cookieParser());
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true },
  store: MongoStore.create({
    mongoUrl: MONGO_URI,
    dbName: 'quizzard',
    collectionName: 'sessions',
    ttl: 1000 * 60 * 60 * 24, // Optional: 1 day session expiry
  })
}));
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

    // Mount page routes
    const pagesRouter = require('./routes/pages');
    app.use('/', pagesRouter);

    // Mount auth routes, injecting the collections
    const authRouter = require('./routes/auth')(usersCol, codesCol);
    app.use('/', authRouter);

    const questionSetsRouter = require('./routes/api/questionSets')(db);
    app.use('/api/questionSets', questionSetsRouter);


    app.use('/', require('./routes/playSettings')(usersCol));

    require('./routes/socket')(io, db, usersCol);


    // Start listening *after* routes are mounted
    server.listen(PORT, () => {
      console.log(`🚀 Server listening on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
  });
