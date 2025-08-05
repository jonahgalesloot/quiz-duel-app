// game/state.js
const matches = {}; // { matchId: { players: [u1,u2], questions: [...], current: idx, answers: {}, scores: {}, ready: {}, timers: {}, chatMessages: [], gamePhase: 'waiting'|'ready'|'question'|'answer'|'next', questionStartTime: number } }

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
      started: false,
      chatMessages: [], // Array of { username, message, timestamp }
      gamePhase: 'waiting', // waiting, ready, question, answer, next
      questionStartTime: null,
      firstAnswerTime: null,
      questionDisplayTime: null
    };
  },
  getMatch(id) { return matches[id]; },
  setReady(id, user) {
    const m = matches[id];
    if (!m) throw new Error("No such match");
    m.ready[user] = true;
  },
  setUnready(id, user) {
    const m = matches[id];
    if (!m) throw new Error("No such match");
    m.ready[user] = false;
  },
  allReady(id) {
    const m = matches[id];
    return m && m.players.every(u => m.ready[u]);
  },
  startGame(id) {
    const m = matches[id];
    if (m) {
      m.started = true;
      m.gamePhase = 'ready';
    }
  },
  startQuestion(id) {
    const m = matches[id];
    if (!m) throw new Error("No such match");
    m.gamePhase = 'question';
    m.questionStartTime = Date.now();
    m.questionDisplayTime = Date.now();
    m.firstAnswerTime = null;
    m.answers = {};
  },
  recordAnswer(id, user, answer, answerTime) {
    const m = matches[id];
    if (!m) throw new Error("No such match");
    if (m.answers[user] !== undefined) return; // already answered
    
    m.answers[user] = { answer, time: answerTime };
    
    // Record first answer time for time reduction
    if (!m.firstAnswerTime) {
      m.firstAnswerTime = answerTime;
    }
  },
  nextQuestion(id) {
    const m = matches[id];
    if (!m) throw new Error("No such match");
    m.current++;
    m.answers = {};
    m.gamePhase = 'waiting';
    m.questionStartTime = null;
    m.firstAnswerTime = null;
    m.questionDisplayTime = null;
    return m.current < m.questions.length;
  },
  getCurrentQuestion(id) {
    const m = matches[id];
    if (!m || m.current >= m.questions.length) return null;
    return m.questions[m.current];
  },
  getTimeLeft(id) {
    const m = matches[id];
    if (!m || !m.questionStartTime) return 0;
    
    const question = this.getCurrentQuestion(id);
    if (!question) return 0;
    
    const elapsed = Date.now() - m.questionStartTime;
    const timeLimit = question.timeLimit * 1000; // Convert to milliseconds
    
    return Math.max(0, timeLimit - elapsed);
  },
  getDisplayTimeLeft(id) {
    const m = matches[id];
    if (!m || !m.questionDisplayTime) return 0;
    
    const elapsed = Date.now() - m.questionDisplayTime;
    const displayTime = 4000; // 4 seconds for reading
    
    return Math.max(0, displayTime - elapsed);
  },
  isInDisplayPhase(id) {
    return this.getDisplayTimeLeft(id) > 0;
  },
  calculateScore(id, user, answerTime) {
    const m = matches[id];
    if (!m) return 0;
    
    const question = this.getCurrentQuestion(id);
    if (!question) return 0;
    
    const answer = m.answers[user];
    if (!answer) return 0;
    
    // AI grading would happen here - for now, assume correct for MCQ
    const isCorrect = question.type === 'mcq' ? 
      question.choices[answer.answer].includes('*') : true;
    
    if (!isCorrect) return 0;
    
    const marks = question.maxMarks;
    const timeLeft = answer.time - m.questionStartTime;
    const maxTime = question.timeLimit * 1000;
    const reducedTime = question.reductionTimeLimit * 1000;
    
    // Time bonus calculation
    const Δ = Math.max(0, Math.sqrt(timeLeft) - Math.sqrt(reducedTime));
    const Δmax = Math.sqrt(maxTime) - Math.sqrt(reducedTime);
    const norm = Δ / Δmax;
    const K = 5000;
    const rawBonus = Math.round(Math.max(1, Math.round(norm * K)));
    const score = Math.sqrt(rawBonus) * marks;
    
    return Math.round(score);
  },
  // Chat message functions
  addChatMessage(id, username, message) {
    const m = matches[id];
    if (!m) throw new Error("No such match");
    m.chatMessages.push({
      username,
      message,
      timestamp: Date.now()
    });
  },
  getChatMessages(id) {
    const m = matches[id];
    return m ? m.chatMessages : [];
  },
  cleanup(id) { delete matches[id]; }
};
