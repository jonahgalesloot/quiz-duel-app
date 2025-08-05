// game/state.js
const matches = {}; // { matchId: { players: [u1,u2], questions: [...], current: idx, answers: {}, scores: {}, ready: {}, timers: {} } }

module.exports = {
  createMatch(id, players, questions) {
    matches[id] = {
      players,
      questions,
      current: 0,
      answers: {},
      scores: players.reduce((o,u)=> (o[u]=0,o), {}),
      ready: players.reduce((o,u)=> (o[u]=false,o), {}),
      timers: {},
      started: false
    };
  },
  getMatch(id) { return matches[id]; },
  setReady(id, user) {
    const m = matches[id];
    if (!m) throw new Error("No such match");
    m.ready[user] = true;
  },
  allReady(id) {
    const m = matches[id];
    return m && m.players.every(u => m.ready[u]);
  },
  startGame(id) {
    const m = matches[id];
    if (m) m.started = true;
  },
  recordAnswer(id, user, correct) {
    const m = matches[id];
    if (!m) throw new Error("No such match");
    if (m.answers[user] !== undefined) return; // already answered
    m.answers[user] = correct;
    if (correct) m.scores[user] += 1;
  },
  nextQuestion(id) {
    const m = matches[id];
    m.current++;
    m.answers = {};
    return m.current < m.questions.length;
  },
  cleanup(id) { delete matches[id]; }
};
