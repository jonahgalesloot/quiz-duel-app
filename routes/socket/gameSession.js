// routes/socket/gameSession.js
const GameSession = require('../../game/gameSession');

class SocketGameSession {
  constructor(io) {
    this.io = io;
    this.gameSession = new GameSession(io);
  }

  // Handle player ready
  handlePlayerReady(socket, user, matchId) {
    if (!user) return;
    this.gameSession.handlePlayerReady(matchId, user.username);
  }

  // Handle player unready
  handlePlayerUnready(socket, user, matchId) {
    if (!user) return;
    this.gameSession.handlePlayerUnready(matchId, user.username);
  }

  // Handle answer submission
  async handleAnswerSubmission(socket, user, matchId, answer) {
    if (!user) return;
    
    try {
      await this.gameSession.handleAnswerSubmission(matchId, user.username, answer);
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  }

  // Handle next question request
  handleNextQuestion(socket, user, matchId) {
    if (!user) return;
    this.gameSession.handleNextQuestion(matchId, user.username);
  }

  // Start a new match
  startMatch(matchId, players, questions) {
    this.gameSession.startMatch(matchId, players, questions);
  }
}

module.exports = SocketGameSession; 