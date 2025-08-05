// public/js/duel.js

const socket = io();
const chatLog   = document.getElementById('chatLog');
const chatInput = document.getElementById('chatInput');
let you, opp;
const matchId = window.location.pathname.split('/').pop();

// Fetch and display your info
(async () => {
  const res = await fetch('/api/user', { credentials:'include' });
  you = await res.json();
  document.getElementById('youName').textContent = you.username;
  document.getElementById('youElo').textContent  = you.elo;
})();

// Send chat
document.getElementById('sendChat').addEventListener('click', () => {
  const msg = chatInput.value.trim();
  if (!msg) return;
  socket.emit('chatMessage', { matchId, message: msg });
  chatInput.value = '';
});

// Receive chat
socket.on('chatMessage', ({ username, message }) => {
  const p = document.createElement('p');
  p.innerHTML = `<strong>${username}:</strong> ${message}`;
  chatLog.appendChild(p);
  chatLog.scrollTop = chatLog.scrollHeight;
});

// Receive system logs
socket.on('systemLog', (txt) => {
  const p = document.createElement('p');
  p.innerHTML = `<em>${txt}</em>`;
  chatLog.appendChild(p);
  chatLog.scrollTop = chatLog.scrollHeight;
});

// Opponent info
socket.on('opponentInfo', data => {
  opp = data;
  document.getElementById('oppName').textContent = opp.username;
  document.getElementById('oppElo').textContent  = opp.elo;
});

// Start game button
const startBtn = document.getElementById('startGameBtn');
startBtn.addEventListener('click', () => {
  startBtn.disabled = true;
  socket.emit('playerReady', { matchId });
  document.getElementById('info').innerText = 'Waiting for opponent…';
});

// Game started
socket.on('gameStarted', () => {
  startBtn.style.display = 'none';
  document.getElementById('info').innerText = 'Game started!';
});

// Timer
socket.on('timer', ({ timeLeft }) => {
  document.getElementById('timer').innerText = `Time left: ${timeLeft}s`;
});

// Question
socket.on('question', ({ question, index }) => {
  renderQuestion(question, index);
});

function renderQuestion(q, idx) {
  document.getElementById('question').innerText = `Q${idx+1}: ${q.prompt}`;
  const ans = document.getElementById('answers');
  ans.innerHTML = '';
  if (q.type === 'mcq' || q.type === 'multiple choice') {
    q.choices.forEach((c, i) => {
      const btn = document.createElement('button');
      btn.innerText = c.replace(/\*/g, '');
      btn.onclick = () => {
        disableAnswers();
        socket.emit('submitAnswer', { matchId, answer: i });
      };
      btn.className = 'button';
      ans.appendChild(btn);
    });
  } else {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Type your answer…';
    input.style.width = '80%';
    ans.appendChild(input);
    const btn = document.createElement('button');
    btn.innerText = 'Submit';
    btn.className = 'button';
    btn.onclick = () => {
      disableAnswers();
      socket.emit('submitAnswer', { matchId, answer: input.value });
    };
    ans.appendChild(btn);
  }
}

function disableAnswers() {
  const ans = document.getElementById('answers');
  Array.from(ans.children).forEach(el => el.disabled = true);
}

// Answer result
socket.on('answerResult', ({ username, correct, scores, aiResult }) => {
  document.getElementById('scores').innerText =
    Object.entries(scores).map(([u,s])=>`${u}: ${s}`).join(' | ');
  if (typeof correct === 'boolean') {
    const msg = correct ? 'Correct!' : 'Incorrect!';
    document.getElementById('info').innerText = `${username}: ${msg}`;
    if (aiResult && aiResult.explanation) {
      document.getElementById('info').innerText += `\n${aiResult.explanation}`;
    }
  }
});

// Match over
socket.on('matchOver', ({ scores }) => {
  document.getElementById('info').innerText =
    'Match Over! ' + Object.entries(scores)
      .map(([u,s])=>`${u}: ${s}`).join(' | ');
  document.getElementById('timer').innerText = '';
});
