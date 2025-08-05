// routes/socket.js
const crypto = require('crypto');
const engine = require('../game/engine');
const state  = require('../game/state');

module.exports = function(io, db, usersCol) {
  const activeMatches = {};
  let queue = [];
  let matchmakingLock = false;

  // helper: load the one question set from MongoDB
  async function loadQuestions() {
    const set = await db
      .collection('sets')
      .findOne({}, { projection: { questions: 1 } });
    return set.questions;
  }

  io.on('connection', socket => {
    const session = socket.handshake.session || {};
    const user    = session.user;
    console.log(`[SOCKET] Connected: ${socket.id} user=${user?.username || 'none'}`);


    // --- Matchmaking ---
    socket.on('joinMatchmaking', async () => {
      if (!user) return;
      if (queue.includes(socket.id)) return;

      console.log(`[SOCKET] ${user.username} wants to join matchmaking`);

      if (matchmakingLock) {
        queue.push(socket.id);
        return socket.emit('systemLog', 'Waiting for opponent…');
      }
      matchmakingLock = true;

      if (queue.length > 0) {
        const otherId = queue.shift();
        const otherSocket = io.sockets.sockets.get(otherId);

        if (!otherSocket || !otherSocket.handshake.session.user) {
          // requeue current if opponent invalid
          queue.push(socket.id);
          matchmakingLock = false;
          return socket.emit('systemLog', 'Opponent invalid, waiting again…');
        }

        // Create a new room
        const roomId = crypto.randomBytes(3).toString('hex').toUpperCase();
        socket.join(roomId);
        otherSocket.join(roomId);

        const youDoc = await usersCol.findOne(
          { email: user.email },
          { projection: { username:1, elo:1 } }
        );
        const oppUser = otherSocket.handshake.session.user;
        const oppDoc  = await usersCol.findOne(
          { email: oppUser.email },
          { projection: { username:1, elo:1 } }
        );

        // Track active match
        activeMatches[roomId] = [ youDoc.username, oppDoc.username ];

        console.log(`[SOCKET] Matched ${youDoc.username} vs ${oppDoc.username} in ${roomId}`);

        // Load questions and start the engine
        const questions = await loadQuestions();
        engine.startMatch(roomId, [ youDoc.username, oppDoc.username ], questions);

        // Notify both clients
        io.to(roomId).emit('matchStarted', {
          matchId: roomId,
          players: [ youDoc, oppDoc ],
          questions // full array; client can index by question number
        });
      } else {
        queue.push(socket.id);
        socket.emit('systemLog', 'Waiting for opponent…');
      }

      matchmakingLock = false;
    });

    // --- Player ready ---
    socket.on('playerReady', ({ matchId }) => {
      if (!user) return;
      engine.setReady(matchId, user.username);
      io.to(matchId).emit('systemLog', `${user.username} is ready!`);
      if (engine.allReady(matchId)) {
        engine.startGame(matchId);
        io.to(matchId).emit('gameStarted');
        sendQuestion(matchId);
      }
    });

    // --- Send question with timer ---
    async function sendQuestion(matchId) {
      const m = state.getMatch(matchId);
      if (!m) return;
      const q = m.questions[m.current];
      io.to(matchId).emit('question', {
        question: q,
        index: m.current
      });
      // Timer logic
      let timeLeft = q.timeLimit || 15;
      io.to(matchId).emit('timer', { timeLeft });
      m.timers.timer = setInterval(() => {
        timeLeft--;
        io.to(matchId).emit('timer', { timeLeft });
        if (timeLeft <= 0) {
          clearInterval(m.timers.timer);
          io.to(matchId).emit('systemLog', 'Time up!');
          // Auto-submit blank for those who didn't answer
          m.players.forEach(u => {
            if (!(u in m.answers)) {
              socket.emit('submitAnswer', { matchId, answer: null });
            }
          });
        }
      }, 1000);
    }


    // --- Answer submission ---
    socket.on('submitAnswer', async ({ matchId, answer }) => {
      if (!user) return;
      try {
        const result = await engine.submitAnswer(matchId, user.username, answer);
        // Broadcast the result to everyone in the room
        io.to(matchId).emit('answerResult', {
          username: user.username,
          correct:   result.correct,
          scores:    result.scores,
          aiResult:  result.aiResult
        });

        // If all answered, move to next question or end
        const m = state.getMatch(matchId);
        if (m && m.players.every(u => u in m.answers)) {
          clearInterval(m.timers.timer);
          setTimeout(() => {
            if (result.next === false) {
              io.to(matchId).emit('matchOver', { scores: result.scores });
              state.cleanup(matchId);
              delete activeMatches[matchId];
            } else {
              sendQuestion(matchId);
            }
          }, 2000); // 2s pause before next question
        }
      } catch (err) {
        console.error(`[SOCKET] submitAnswer error for ${user.username} in ${matchId}:`, err);
        socket.emit('error', { message: err.message });
      }
    });

    // --- Chat (optional) ---
    socket.on('chatMessage', ({ matchId, message }) => {
      if (!user) return;
      io.to(matchId).emit('chatMessage', {
        username: user.username,
        message
      });
    });

    // --- Disconnect handling ---
    socket.on('disconnect', () => {
      console.log(`[SOCKET] Disconnected: ${socket.id} user=${user?.username || 'none'}`);
      // Remove from queue if waiting
      const idx = queue.indexOf(socket.id);
      if (idx !== -1) queue.splice(idx, 1);

      // Clean up any empty matches
      for (const [roomId, players] of Object.entries(activeMatches)) {
        const room = io.sockets.adapter.rooms.get(roomId);
        if (!room || room.size === 0) {
          console.log(`[SOCKET] Cleaning up empty match ${roomId}`);
          state.cleanup(roomId);
          delete activeMatches[roomId];
        }
      }
    });
  });

  // Expose activeMatches if needed elsewhere
  return { activeMatches };
};
