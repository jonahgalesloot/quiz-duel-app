// game/engine.js
const state = require('./state');
const fetch = require('node-fetch');

function startMatch(matchId, players, questions) {
  state.createMatch(matchId, players, questions);
}

function setReady(matchId, username) {
  state.setReady(matchId, username);
}

function allReady(matchId) {
  return state.allReady(matchId);
}

function startGame(matchId) {
  state.startGame(matchId);
}

async function submitAnswer(matchId, username, answer) {
  const m = state.getMatch(matchId);
  const q = m.questions[m.current];
  let correct = null;
  let aiResult = null;
  if (q.type === 'mcq' || q.type === 'multiple choice') {
    // MCQ: correct answer is denoted by stars in choices
    const correctIdx = q.choices.findIndex(c => /\*/.test(c));
    correct = (answer === correctIdx);
  } else {
    // Short/long answer: call AI grading API
    try {
      const res = await fetch('http://localhost:3000/api/game/ai-grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answer,
          rubric: q.rubric || '',
          prompt: q.prompt
        })
      });
      aiResult = await res.json();
      correct = aiResult.mark >= 0.5; // consider 0.5+ as correct
    } catch (err) {
      correct = false;
      aiResult = { mark: 0, explanation: 'AI error' };
    }
  }

  state.recordAnswer(matchId, username, correct);

  // once *all* players answered:
  if (m.players.every(u => u in m.answers)) {
    const stillMore = state.nextQuestion(matchId);
    return { correct, scores: m.scores, next: stillMore, aiResult };
  }
  return { correct, waiting: true, aiResult };
}

module.exports = { startMatch, setReady, allReady, startGame, submitAnswer };
