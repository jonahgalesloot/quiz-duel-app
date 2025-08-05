// routes/socket/chat.js
const gameState = require('../../game/state');

class SocketChat {
  constructor(io) {
    this.io = io;
  }

  // Handle chat message
  handleChatMessage(socket, user, matchId, message) {
    if (!user) return;
    
    // Add message to game state
    gameState.addChatMessage(matchId, user.username, message);
    
    // Emit to all players in the room
    this.io.to(matchId).emit('chatMessage', {
      username: user.username,
      message
    });
  }

  // Send existing chat messages to a player who just joined
  sendExistingMessages(socket, matchId) {
    const messages = gameState.getChatMessages(matchId);
    if (messages.length > 0) {
      socket.emit('existingChatMessages', messages);
    }
  }
}

module.exports = SocketChat; 