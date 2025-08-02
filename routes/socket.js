// routes/socket.js
const activeMatches = {};  // matchId → [usernameA, usernameB]
let queue = [];            // array of socket.id waiting for match

module.exports = function(io, db, usersCol) {
  io.on('connection', socket => {
    // get session user (set at login)
    const session = socket.handshake.session || {};
    const user   = session.user;

    // 1) Player clicks “Join Queue”
    socket.on('joinMatchmaking', async () => {
      if (!user) return;               // must be logged in
      if (queue.includes(socket.id)) return;

      // If someone’s waiting, pair them
      if (queue.length > 0) {
        const otherId = queue.shift();
        const roomId  = Math.random().toString(36).slice(2,8).toUpperCase();

        // Both sockets join the Socket.io room
        socket.join(roomId);
        const otherSocket = io.sockets.sockets.get(otherId);
        if (!otherSocket) {
          // If the other disconnected unexpectedly, requeue self
          queue.push(socket.id);
          return socket.emit('systemLog', 'Opponent disconnected, waiting again…');
        }
        otherSocket.join(roomId);

        // Fetch both players’ data from Mongo for Elo
        const [youDoc, oppDoc] = await Promise.all([
          usersCol.findOne({ username: user.username }, { projection: { username:1, elo:1 } }),
          usersCol.findOne({ username: otherSocket.handshake.session.user.username }, { projection: { username:1, elo:1 } })
        ]);

        // Record active match participants
        activeMatches[roomId] = [ youDoc.username, oppDoc.username ];

        // Notify each client
        socket.emit('matched', { matchId: roomId, opponent: oppDoc });
        otherSocket.emit('matched', { matchId: roomId, opponent: youDoc });

      } else {
        // No one waiting → join the queue
        queue.push(socket.id);
        socket.emit('systemLog', 'Waiting for opponent…');
      }
    });

    // 2) Client-side will do socket.emit('joinMatch', matchId)
    socket.on('joinMatch', (matchId) => {
      socket.join(matchId);
    });

    // 3) Simple chat broadcast within the match room
    socket.on('chatMessage', ({ matchId, message }) => {
      const sender = user.username;
      io.to(matchId).emit('chatMessage', { username: sender, message });
    });

    // 4) Clean up on disconnect
    socket.on('disconnect', () => {
      // Remove from matchmaking queue if still waiting
      const idx = queue.indexOf(socket.id);
      if (idx !== -1) queue.splice(idx, 1);

      // (Optional) You might also delete activeMatches entries if both disconnect…
    });
  });
};

// Export the activeMatches map so your route middleware can use it
module.exports.activeMatches = activeMatches;
