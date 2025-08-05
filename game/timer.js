// game/timer.js
const state = require('./state');

class GameTimer {
  constructor(io) {
    this.io = io;
  }

  // Start timer for a question
  startQuestionTimer(matchId, questionIndex) {
    const m = state.getMatch(matchId);
    if (!m) return;

    const q = m.questions[m.current];
    let timeLeft = q.timeLimit || 15;

    // Send initial timer
    this.io.to(matchId).emit('timer', { timeLeft });

    // Clear any existing timer
    if (m.timers.timer) {
      clearInterval(m.timers.timer);
    }

    // Start countdown
    m.timers.timer = setInterval(() => {
      timeLeft--;
      this.io.to(matchId).emit('timer', { timeLeft });

      if (timeLeft <= 0) {
        this.handleTimeUp(matchId);
      }
    }, 1000);
  }

  // Handle time up
  handleTimeUp(matchId) {
    const m = state.getMatch(matchId);
    if (!m) return;

    // Clear timer
    if (m.timers.timer) {
      clearInterval(m.timers.timer);
    }

    this.io.to(matchId).emit('systemLog', 'Time up!');

    // Auto-submit blank for those who didn't answer
    m.players.forEach(u => {
      if (!(u in m.answers)) {
        // Simulate auto-submit
        this.io.to(matchId).emit('submitAnswer', { matchId, answer: null });
      }
    });
  }

  // Stop timer
  stopTimer(matchId) {
    const m = state.getMatch(matchId);
    if (m && m.timers.timer) {
      clearInterval(m.timers.timer);
    }
  }
}

module.exports = GameTimer; 