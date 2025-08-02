// routes/socket.js
const activeMatches = {};  // matchId → [usernameA, usernameB]
let queue = [];            // array of socket.id waiting for match
let matchmakingLock = false; // simple lock for matchmaking

module.exports = function(io, db, usersCol) {
  io.on('connection', socket => {
    // get session user (set at login)
    const session = socket.handshake.session || {};
    const user   = session.user;

    // 1) Player clicks “Join Queue”
    socket.on('joinMatchmaking', async () => {
      // Always get user from session
      const user = socket.handshake.session.user;
      console.log('joinMatchmaking from', socket.id, 'session.user =', user);

      if (!user) return;
      if (queue.includes(socket.id)) return;

      // Simple lock to prevent race conditions
      if (matchmakingLock) {
        queue.push(socket.id);
        socket.emit('systemLog', 'Waiting for opponent…');
        return;
      }
      matchmakingLock = true;

      if (queue.length > 0) {
        const otherId = queue.shift();
        const roomId  = Math.random().toString(36).slice(2,8).toUpperCase();

        socket.join(roomId);
        const otherSocket = io.sockets.sockets.get(otherId);
        if (!otherSocket) {
          queue.push(socket.id);
          matchmakingLock = false;
          return socket.emit('systemLog', 'Opponent disconnected, waiting again…');
        }
        otherSocket.join(roomId);

        // Fetch both players’ data from Mongo for Elo
        let youDoc, oppDoc;
        try {
          [youDoc, oppDoc] = await Promise.all([
            usersCol.findOne({ username: user.username }, { projection: { username:1, elo:1 } }),
            usersCol.findOne({ username: otherSocket.handshake.session.user.username }, { projection: { username:1, elo:1 } })
          ]);
        } catch (e) {
          matchmakingLock = false;
          return socket.emit('systemLog', 'Error fetching user data.');
        }

        activeMatches[roomId] = [ youDoc.username, oppDoc.username ];

        socket.emit('matched', { matchId: roomId, opponent: oppDoc });
        otherSocket.emit('matched', { matchId: roomId, opponent: youDoc });
      } else {
        queue.push(socket.id);
        socket.emit('systemLog', 'Waiting for opponent…');
      }
      matchmakingLock = false;
    });

    // 2) Client-side will do socket.emit('joinMatch', matchId)
    socket.on('joinMatch', (matchId) => {
      socket.join(matchId);
    });

    // 3) Simple chat broadcast within the match room
    socket.on('chatMessage', ({ matchId, message }) => {
      const user = socket.handshake.session.user;
      if (!user) return;
      const sender = user.username;
      io.to(matchId).emit('chatMessage', { username: sender, message });
    });

    // Handle registerPlayer to send opponent info
    socket.on('registerPlayer', ({ matchId, username }) => {
      const players = activeMatches[matchId];
      if (!players) return;
      // Find opponent username
      const oppUsername = players.find(u => u !== username);
      if (!oppUsername) return;
      usersCol.findOne({ username: oppUsername }, { projection: { username:1, elo:1 } })
        .then(oppDoc => {
          if (!oppDoc) return;
          // Send to both players
          io.to(matchId).emit('opponentInfo', oppDoc);
        });
    });

    // 4) Clean up on disconnect
    socket.on('disconnect', () => {
      // Remove from matchmaking queue if still waiting
      const idx = queue.indexOf(socket.id);
      if (idx !== -1) queue.splice(idx, 1);

      // Clean up activeMatches if both players have left
      for (const [matchId, players] of Object.entries(activeMatches)) {
        // Find all sockets in the room
        const room = io.sockets.adapter.rooms.get(matchId);
        if (!room || room.size === 0) {
          delete activeMatches[matchId];
        }
      }
    });
  });
};

// Export the activeMatches map so your route middleware can use it
module.exports.activeMatches = activeMatches;
