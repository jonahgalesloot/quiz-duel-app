// game/matchmaking.js
const crypto = require('crypto');

class Matchmaking {
  constructor() {
    this.queue = [];
    this.matchmakingLock = false;
    this.activeMatches = {};
    this.cleanupTimers = {}; // Track cleanup timers for each match
  }

  // Add player to queue
  addToQueue(socketId) {
    if (this.queue.includes(socketId)) return false;
    this.queue.push(socketId);
    return true;
  }

  // Remove player from queue
  removeFromQueue(socketId) {
    const idx = this.queue.indexOf(socketId);
    if (idx !== -1) {
      this.queue.splice(idx, 1);
      return true;
    }
    return false;
  }

  // Try to match players
  async tryMatch(socketId, io, usersCol, loadQuestions) {
    if (this.matchmakingLock) {
      return { status: 'queued', message: 'Waiting for opponent…' };
    }

    this.matchmakingLock = true;

    if (this.queue.length > 0) {
      const otherId = this.queue.shift();
      const otherSocket = io.sockets.sockets.get(otherId);

      if (!otherSocket || !otherSocket.handshake.session.user) {
        // requeue current if opponent invalid
        this.queue.push(socketId);
        this.matchmakingLock = false;
        return { status: 'requeued', message: 'Opponent invalid, waiting again…' };
      }

      // Create match
      const match = await this.createMatch(socketId, otherSocket, io, usersCol, loadQuestions);
      this.matchmakingLock = false;
      return match;
    } else {
      this.queue.push(socketId);
      this.matchmakingLock = false;
      return { status: 'queued', message: 'Waiting for opponent…' };
    }
  }

  // Create a new match
  async createMatch(socketId, otherSocket, io, usersCol, loadQuestions) {
    const socket = io.sockets.sockets.get(socketId);
    const user = socket.handshake.session.user;
    const oppUser = otherSocket.handshake.session.user;

    // Create room
    const roomId = crypto.randomBytes(3).toString('hex').toUpperCase();
    socket.join(roomId);
    otherSocket.join(roomId);

    // Get user data
    const youDoc = await usersCol.findOne(
      { email: user.email },
      { projection: { username: 1, elo: 1 } }
    );
    const oppDoc = await usersCol.findOne(
      { email: oppUser.email },
      { projection: { username: 1, elo: 1 } }
    );

    // Track active match
    this.activeMatches[roomId] = [youDoc.username, oppDoc.username];

    console.log(`[MATCHMAKING] Matched ${youDoc.username} vs ${oppDoc.username} in ${roomId}`);

    // Load questions
    const questions = await loadQuestions();

    return {
      status: 'matched',
      roomId,
      players: [youDoc, oppDoc],
      questions,
      otherSocketId: otherSocket.id
    };
  }

  // Get active matches
  getActiveMatches() {
    return this.activeMatches;
  }

  // Remove active match
  removeActiveMatch(roomId) {
    delete this.activeMatches[roomId];
    // Clear any pending cleanup timer
    if (this.cleanupTimers[roomId]) {
      clearTimeout(this.cleanupTimers[roomId]);
      delete this.cleanupTimers[roomId];
    }
  }

  // Clean up empty matches with delay
  cleanupEmptyMatches(io) {
    for (const [roomId, players] of Object.entries(this.activeMatches)) {
      const room = io.sockets.adapter.rooms.get(roomId);
      console.log(`[MATCHMAKING] Checking room ${roomId}: size=${room?.size || 0}, players=${players.join(', ')}`);
      
      if (!room || room.size === 0) {
        // Set a timer to clean up after delay
        if (!this.cleanupTimers[roomId]) {
          console.log(`[MATCHMAKING] Setting cleanup timer for empty match ${roomId}`);
          this.cleanupTimers[roomId] = setTimeout(() => {
            // Double-check that the room is still empty before cleaning up
            const currentRoom = io.sockets.adapter.rooms.get(roomId);
            if (!currentRoom || currentRoom.size === 0) {
              console.log(`[MATCHMAKING] Cleaning up empty match ${roomId} after delay`);
              this.removeActiveMatch(roomId);
            } else {
              console.log(`[MATCHMAKING] Room ${roomId} has ${currentRoom.size} players, cancelling cleanup`);
            }
          }, 10000); // 10 second delay
        }
      } else {
        // Room has players, clear any pending cleanup
        if (this.cleanupTimers[roomId]) {
          console.log(`[MATCHMAKING] Room ${roomId} has ${room.size} players, cancelling cleanup timer`);
          clearTimeout(this.cleanupTimers[roomId]);
          delete this.cleanupTimers[roomId];
        }
      }
    }
  }
}

module.exports = Matchmaking; 