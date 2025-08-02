// routes/socket.js
const activeMatches = {};  // matchId → [usernameA, usernameB]
let queue = [];            // array of socket.id waiting for match
let matchmakingLock = false; // simple lock for matchmaking

module.exports = function(io, db, usersCol) {
  io.on('connection', socket => {
    const session = socket.handshake.session || {};
    const user   = session.user;
    console.log(`[SOCKET] Connected: ${socket.id} user=${user ? user.username : 'none'}`);

    socket.on('joinMatchmaking', async () => {
      const user = socket.handshake.session.user;
      console.log(`[SOCKET] joinMatchmaking from ${socket.id} user=${user ? user.username : 'none'}`);

      if (!user) return;
      if (queue.includes(socket.id)) return;

      if (matchmakingLock) {
        queue.push(socket.id);
        socket.emit('systemLog', 'Waiting for opponent…');
        console.log(`[SOCKET] ${socket.id} added to queue (locked). Queue:`, queue);
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
          console.log(`[SOCKET] Opponent ${otherId} disconnected before match. ${socket.id} requeued.`);
          return socket.emit('systemLog', 'Opponent disconnected, waiting again…');
        }
        const otherUser = otherSocket.handshake.session.user;
        if (!otherUser) {
          queue.push(socket.id);
          matchmakingLock = false;
          console.log(`[SOCKET] Opponent ${otherId} has no session user. ${socket.id} requeued.`);
          return socket.emit('systemLog', 'Opponent not logged in, waiting again…');
        }
        otherSocket.join(roomId);

        let youDoc, oppDoc;
        try {
          [youDoc, oppDoc] = await Promise.all([
            usersCol.findOne({ username: user.username }, { projection: { username:1, elo:1 } }),
            usersCol.findOne({ username: otherUser.username }, { projection: { username:1, elo:1 } })
          ]);
        } catch (e) {
          matchmakingLock = false;
          console.log(`[SOCKET] Error fetching user data for match:`, e);
          return socket.emit('systemLog', 'Error fetching user data.');
        }

        activeMatches[roomId] = [ youDoc.username, oppDoc.username ];
        console.log(`[SOCKET] Match made: ${roomId} between ${youDoc.username} and ${oppDoc.username}`);

        socket.emit('matched', { matchId: roomId, opponent: oppDoc });
        otherSocket.emit('matched', { matchId: roomId, opponent: youDoc });
      } else {
        queue.push(socket.id);
        socket.emit('systemLog', 'Waiting for opponent…');
        console.log(`[SOCKET] ${socket.id} added to queue. Queue:`, queue);
      }
      matchmakingLock = false;
    });

    socket.on('joinMatch', (matchId) => {
      socket.join(matchId);
      const user = socket.handshake.session.user;
      console.log(`[SOCKET] ${user ? user.username : socket.id} joined match room ${matchId}`);
    });

    socket.on('chatMessage', ({ matchId, message }) => {
      const user = socket.handshake.session.user;
      if (!user) return;
      const sender = user.username;
      console.log(`[SOCKET] Chat in ${matchId} from ${sender}: ${message}`);
      io.to(matchId).emit('chatMessage', { username: sender, message });
    });

    socket.on('registerPlayer', ({ matchId, username }) => {
      const players = activeMatches[matchId];
      if (!players) return;
      const oppUsername = players.find(u => u !== username);
      if (!oppUsername) return;
      usersCol.findOne({ username: oppUsername }, { projection: { username:1, elo:1 } })
        .then(oppDoc => {
          if (!oppDoc) return;
          io.to(matchId).emit('opponentInfo', oppDoc);
          console.log(`[SOCKET] Sent opponentInfo for ${oppUsername} in match ${matchId}`);
        });
    });

    socket.on('disconnect', () => {
      const user = socket.handshake.session.user;
      console.log(`[SOCKET] Disconnected: ${socket.id} user=${user ? user.username : 'none'}`);
      const idx = queue.indexOf(socket.id);
      if (idx !== -1) {
        queue.splice(idx, 1);
        console.log(`[SOCKET] ${socket.id} removed from queue on disconnect.`);
      }
      for (const [matchId, players] of Object.entries(activeMatches)) {
        const room = io.sockets.adapter.rooms.get(matchId);
        if (!room || room.size === 0) {
          console.log(`[SOCKET] Cleaning up empty match ${matchId}`);
          delete activeMatches[matchId];
        }
      }
    });
  });
};

module.exports.activeMatches = activeMatches;
