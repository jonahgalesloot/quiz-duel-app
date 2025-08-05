// routes/socket/matchmaking.js
const Matchmaking = require('../../game/matchmaking');

class SocketMatchmaking {
  constructor(io, db, usersCol, gameSession) {
    this.io = io;
    this.db = db;
    this.usersCol = usersCol;
    this.gameSession = gameSession;
    this.matchmaking = new Matchmaking();
  }

  // Load questions from database
  async loadQuestions() {
    const set = await this.db
      .collection('sets')
      .findOne({}, { projection: { questions: 1 } });
    return set.questions;
  }

  // Handle join matchmaking
  async handleJoinMatchmaking(socket, user) {
    if (!user) return;

    console.log(`[SOCKET] ${user.username} wants to join matchmaking`);

    const result = await this.matchmaking.tryMatch(
      socket.id,
      this.io,
      this.usersCol,
      this.loadQuestions.bind(this)
    );

    if (result.status === 'queued' || result.status === 'requeued') {
      socket.emit('systemLog', result.message);
    } else if (result.status === 'matched') {
      // Initialize the game session
      const playerNames = result.players.map(p => p.username);
      this.gameSession.startMatch(result.roomId, playerNames, result.questions);
      
      // Ensure both players are in the room
      const socket1 = this.io.sockets.sockets.get(socket.id);
      const socket2 = this.io.sockets.sockets.get(result.otherSocketId);
      
      if (socket1) socket1.join(result.roomId);
      if (socket2) socket2.join(result.roomId);
      
      // Emit match started event to both players
      this.io.to(result.roomId).emit('matchStarted', {
        matchId: result.roomId,
        players: result.players,
        questions: result.questions
      });

      // Emit redirect events to both players
      this.io.to(result.roomId).emit('redirectToMatch', {
        matchId: result.roomId
      });

      console.log(`[MATCHMAKING] Game session started for match ${result.roomId}`);
    }
  }

  // Handle disconnect with delay to prevent premature cleanup
  handleDisconnect(socketId) {
    this.matchmaking.removeFromQueue(socketId);
    
    // Only trigger cleanup if this was a matchmaking disconnect
    // Don't trigger cleanup for normal page navigation
    // The cleanup will happen naturally when rooms are truly empty
    console.log(`[SOCKET] Socket ${socketId} disconnected, but not triggering immediate cleanup`);
  }

  // Get active matches
  getActiveMatches() {
    return this.matchmaking.getActiveMatches();
  }
}

module.exports = SocketMatchmaking; 