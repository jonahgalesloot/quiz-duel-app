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

  // Join the Socket.io match room
  socket.emit('joinMatch', matchId);
  
  // Let server know who you are
  socket.emit('registerPlayer', { matchId, username: you.username });
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

// Receive system logs (e.g. “Game starting”, “Question 1”)
socket.on('systemLog', (txt) => {
  const p = document.createElement('p');
  p.innerHTML = `<em>${txt}</em>`;
  chatLog.appendChild(p);
  chatLog.scrollTop = chatLog.scrollHeight;
});

// When server announces the opponent
socket.on('opponentInfo', data => {
  opp = data;
  document.getElementById('oppName').textContent = opp.username;
  document.getElementById('oppElo').textContent  = opp.elo;
});
