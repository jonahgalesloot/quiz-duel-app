// game/gameSession.js
const state = require('./state');

class GameSession {
  constructor(io) {
    this.io = io;
    this.timers = new Map(); // Track timers for each match
  }

  // Handle player ready
  handlePlayerReady(matchId, username) {
    try {
      state.setReady(matchId, username);
      this.io.to(matchId).emit('systemLog', `${username} is ready!`);
      
      // Update ready state for all players
      this.io.to(matchId).emit('playerReadyState', {
        username,
        ready: true
      });

      if (state.allReady(matchId)) {
        this.startQuestion(matchId);
      }
    } catch (err) {
      console.error(`[GAME] handlePlayerReady error:`, err);
    }
  }

  // Handle player unready
  handlePlayerUnready(matchId, username) {
    try {
      state.setUnready(matchId, username);
      this.io.to(matchId).emit('systemLog', `${username} is no longer ready!`);
      
      // Update ready state for all players
      this.io.to(matchId).emit('playerReadyState', {
        username,
        ready: false
      });
    } catch (err) {
      console.error(`[GAME] handlePlayerUnready error:`, err);
    }
  }

  // Start a question
  startQuestion(matchId) {
    try {
      state.startQuestion(matchId);
      const question = state.getCurrentQuestion(matchId);
      
      if (!question) {
        this.endMatch(matchId);
        return;
      }

      // Send question to all players
      this.io.to(matchId).emit('question', {
        question,
        index: state.getMatch(matchId).current,
        total: state.getMatch(matchId).questions.length
      });

      // Start display timer (4 seconds to read question)
      this.startDisplayTimer(matchId);
    } catch (err) {
      console.error(`[GAME] startQuestion error:`, err);
    }
  }

  // Start display timer (4 seconds to read question)
  startDisplayTimer(matchId) {
    const timer = setInterval(() => {
      const displayTimeLeft = state.getDisplayTimeLeft(matchId);
      
      if (displayTimeLeft <= 0) {
        clearInterval(timer);
        this.timers.delete(matchId);
        this.startAnswerTimer(matchId);
      } else {
        this.io.to(matchId).emit('displayTimer', {
          timeLeft: Math.ceil(displayTimeLeft / 1000)
        });
      }
    }, 100);

    this.timers.set(matchId, timer);
  }

  // Start answer timer
  startAnswerTimer(matchId) {
    const timer = setInterval(() => {
      const timeLeft = state.getTimeLeft(matchId);
      
      if (timeLeft <= 0) {
        clearInterval(timer);
        this.timers.delete(matchId);
        this.endQuestion(matchId);
      } else {
        this.io.to(matchId).emit('answerTimer', {
          timeLeft: Math.ceil(timeLeft / 1000)
        });
      }
    }, 100);

    this.timers.set(matchId, timer);
  }

  // Handle answer submission
  async handleAnswerSubmission(matchId, username, answer) {
    try {
      const answerTime = Date.now();
      state.recordAnswer(matchId, username, answer, answerTime);
      
      // Send answer confirmation to the player
      this.io.to(matchId).emit('answerSubmitted', {
        username,
        answer: answer,
        questionType: state.getCurrentQuestion(matchId).type
      });

      // Check if all players have answered
      const m = state.getMatch(matchId);
      if (m && m.players.every(u => m.answers[u])) {
        this.endQuestion(matchId);
      }
    } catch (err) {
      console.error(`[GAME] handleAnswerSubmission error:`, err);
    }
  }

  // End current question and show results
  endQuestion(matchId) {
    try {
      const m = state.getMatch(matchId);
      if (!m) return;

      // Stop timer
      const timer = this.timers.get(matchId);
      if (timer) {
        clearInterval(timer);
        this.timers.delete(matchId);
      }

      // Calculate scores for all players
      const scores = {};
      const question = state.getCurrentQuestion(matchId);
      
      m.players.forEach(player => {
        const answer = m.answers[player];
        if (answer) {
          scores[player] = state.calculateScore(matchId, player, answer.time);
          m.scores[player] += scores[player];
        } else {
          scores[player] = 0;
        }
      });

      // Send results to all players
      this.io.to(matchId).emit('questionResults', {
        correctAnswer: question.correctAnswer,
        scores,
        totalScores: m.scores
      });

      // Set game phase to 'next'
      m.gamePhase = 'next';
    } catch (err) {
      console.error(`[GAME] endQuestion error:`, err);
    }
  }

  // Handle next question request
  handleNextQuestion(matchId, username) {
    try {
      const m = state.getMatch(matchId);
      if (!m || m.gamePhase !== 'next') return;

      // Mark player as ready for next question
      if (!m.nextReady) m.nextReady = {};
      m.nextReady[username] = true;

      // Check if all players are ready for next question
      if (m.players.every(u => m.nextReady[u])) {
        if (state.nextQuestion(matchId)) {
          this.startQuestion(matchId);
        } else {
          this.endMatch(matchId);
        }
      }
    } catch (err) {
      console.error(`[GAME] handleNextQuestion error:`, err);
    }
  }

  // End match
  endMatch(matchId) {
    try {
      const m = state.getMatch(matchId);
      if (!m) return;

      this.io.to(matchId).emit('matchOver', { 
        scores: m.scores 
      });
      
      // Clean up timer
      const timer = this.timers.get(matchId);
      if (timer) {
        clearInterval(timer);
        this.timers.delete(matchId);
      }
      
      state.cleanup(matchId);
    } catch (err) {
      console.error(`[GAME] endMatch error:`, err);
    }
  }

  // Start a new match
  startMatch(matchId, players, questions) {
    try {
      state.createMatch(matchId, players, questions);
      console.log(`[GAME] Started match ${matchId} with ${players.length} players`);
    } catch (err) {
      console.error(`[GAME] startMatch error:`, err);
    }
  }
}

module.exports = GameSession; 