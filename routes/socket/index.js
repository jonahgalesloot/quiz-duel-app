// routes/socket/index.js
const SocketMatchmaking = require('./matchmaking');
const SocketGameSession = require('./gameSession');
const SocketChat = require('./chat');

module.exports = function(io, db, usersCol) {
  const gameSession = new SocketGameSession(io);
  const matchmaking = new SocketMatchmaking(io, db, usersCol, gameSession);
  const chat = new SocketChat(io);

  io.on('connection', socket => {
    const session = socket.handshake.session || {};
    const user = session.user;
    console.log(`[SOCKET] Connected: ${socket.id} user=${user?.username || 'none'}`);

    // --- Join specific match room ---
    socket.on('joinMatch', async ({ matchId }) => {
      if (!user) {
        console.log(`[SOCKET] User not authenticated for joinMatch ${matchId}`);
        return;
      }
      
      // Join the socket room
      socket.join(matchId);
      console.log(`[SOCKET] ${user.username} joined match room: ${matchId}. Current room size: ${io.sockets.adapter.rooms.get(matchId)?.size || 0}`);
      
      // Send existing chat messages to the joining player
      chat.sendExistingMessages(socket, matchId);
      
      // Get the active match data
      const activeMatches = matchmaking.getActiveMatches();
      const matchPlayers = activeMatches[matchId];
      
      if (matchPlayers) {
        // Find the other player in this match
        const otherPlayerUsername = matchPlayers.find(player => player !== user.username);
        
        if (otherPlayerUsername) {
          // Get full user data for the opponent
          const otherPlayerDoc = await usersCol.findOne(
            { username: otherPlayerUsername },
            { projection: { username: 1, elo: 1 } }
          );
          
          if (otherPlayerDoc) {
            // Send opponent info to the joining player
            socket.emit('opponentInfo', otherPlayerDoc);
            
            // Send this player's info to the other player (if they're in the room)
            const userDoc = await usersCol.findOne(
              { username: user.username },
              { projection: { username: 1, elo: 1 } }
            );
            socket.to(matchId).emit('opponentInfo', userDoc);
          }
          
          // Notify all players in the room about the join
          io.to(matchId).emit('playerJoined', { username: user.username });
        }
      }
    });

    // --- Matchmaking ---
    socket.on('joinMatchmaking', async () => {
      await matchmaking.handleJoinMatchmaking(socket, user);
    });

    // --- Player ready/unready ---
    socket.on('playerReady', ({ matchId }) => {
      gameSession.handlePlayerReady(socket, user, matchId);
    });

    socket.on('playerUnready', ({ matchId }) => {
      gameSession.handlePlayerUnready(socket, user, matchId);
    });

    // --- Answer submission ---
    socket.on('submitAnswer', async ({ matchId, answer }) => {
      await gameSession.handleAnswerSubmission(socket, user, matchId, answer);
    });

    // --- Next question ---
    socket.on('nextQuestion', ({ matchId }) => {
      gameSession.handleNextQuestion(socket, user, matchId);
    });

    // --- Chat ---
    socket.on('chatMessage', ({ matchId, message }) => {
      chat.handleChatMessage(socket, user, matchId, message);
    });

    // --- Disconnect handling ---
    socket.on('disconnect', () => {
      console.log(`[SOCKET] Disconnected: ${socket.id} user=${user?.username || 'none'}`);
      matchmaking.handleDisconnect(socket.id);
    });
  });

  // Expose activeMatches if needed elsewhere
  return { 
    activeMatches: matchmaking.getActiveMatches.bind(matchmaking)
  };
}; 