// public/js/duel.js

const socket = io();
const chatLog   = document.getElementById('chatLog');
const chatInput = document.getElementById('chatInput');
let you, opp;
const matchId = window.location.pathname.split('/').pop();
let currentQuestion = null;
let gamePhase = 'waiting'; // waiting, ready, question, answer, next

console.log('Duel page loaded for match:', matchId);

// Load match data from sessionStorage if available
let matchData = null;
try {
  const stored = sessionStorage.getItem('currentMatch');
  if (stored) {
    matchData = JSON.parse(stored);
    console.log('Loaded match data:', matchData);
  }
} catch (e) {
  console.log('No stored match data');
}

// Fetch and display your info, then join the match room
(async () => {
  try {
    const res = await fetch('/api/auth/user', { credentials:'include' });
    you = await res.json();
    document.getElementById('youName').textContent = you.username;
    document.getElementById('youElo').textContent = `Elo: ${you.elo}`;
    
    // Load user avatar
    document.getElementById('youAvatar').src = `/api/auth/avatar-download/${you.username}`;
    
    // Set opponent info from match data if available
    if (matchData && matchData.players) {
      const otherPlayer = matchData.players.find(p => p.username !== you.username);
      if (otherPlayer) {
        opp = otherPlayer;
        document.getElementById('oppName').textContent = opp.username;
        document.getElementById('oppElo').textContent = `Elo: ${opp.elo}`;
        document.getElementById('oppAvatar').src = `/api/auth/avatar-download/${opp.username}`;
      }
    }
    
    // Join the match room with a small delay to ensure proper timing
    setTimeout(() => {
      socket.emit('joinMatch', { matchId });
      console.log('Joined match room:', matchId);
    }, 100);
  } catch (err) {
    console.error('Error loading user info:', err);
  }
})();

// Send chat
document.getElementById('sendChat').addEventListener('click', () => {
  const msg = chatInput.value.trim();
  if (!msg) return;
  console.log('Sending chat message:', msg);
  socket.emit('chatMessage', { matchId, message: msg });
  chatInput.value = '';
});

// Handle Enter key in chat input
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('sendChat').click();
  }
});

// Helper function to add chat message
function addChatMessage(username, message) {
  const p = document.createElement('p');
  p.className = 'chat-message';
  
  // Show "You:" for own messages, username for others
  const displayName = username === you?.username ? 'You' : username;
  p.innerHTML = `<strong>${displayName}:</strong> ${message}`;
  
  chatLog.appendChild(p);
  chatLog.scrollTop = chatLog.scrollHeight;
}

// Receive chat
socket.on('chatMessage', ({ username, message }) => {
  console.log('Received chat:', username, message);
  addChatMessage(username, message);
});

// Receive existing chat messages when joining
socket.on('existingChatMessages', (messages) => {
  console.log('Loading existing chat messages:', messages.length);
  messages.forEach(({ username, message }) => {
    addChatMessage(username, message);
  });
});

// Receive system logs
socket.on('systemLog', (txt) => {
  console.log('System log:', txt);
  const p = document.createElement('p');
  p.className = 'chat-message';
  p.innerHTML = `<em>${txt}</em>`;
  chatLog.appendChild(p);
  chatLog.scrollTop = chatLog.scrollHeight;
});

// Player joined notification - emit to all players in room
socket.on('playerJoined', ({ username }) => {
  console.log('Player joined:', username);
  const p = document.createElement('p');
  p.className = 'chat-message';
  p.innerHTML = `<em>${username} joined the match</em>`;
  chatLog.appendChild(p);
  chatLog.scrollTop = chatLog.scrollHeight;
});

// Opponent info - try to get from match data first
if (matchData && matchData.players) {
  const otherPlayer = matchData.players.find(p => p.username !== you?.username);
  if (otherPlayer) {
    opp = otherPlayer;
    document.getElementById('oppName').textContent = opp.username;
    document.getElementById('oppElo').textContent = `Elo: ${opp.elo}`;
    document.getElementById('oppAvatar').src = `/api/auth/avatar-download/${opp.username}`;
  }
}

socket.on('opponentInfo', data => {
  opp = data;
  document.getElementById('oppName').textContent = opp.username;
  document.getElementById('oppElo').textContent = `Elo: ${opp.elo}`;
  document.getElementById('oppAvatar').src = `/api/auth/avatar-download/${opp.username}`;
});

// Ready button handling
const startBtn = document.getElementById('startGameBtn');
let isReady = false;

startBtn.addEventListener('click', () => {
  if (!isReady) {
    console.log('Player ready button clicked');
    isReady = true;
    startBtn.textContent = 'Cancel';
    startBtn.classList.add('cancel-btn');
    socket.emit('playerReady', { matchId });
    document.getElementById('info').innerText = 'Waiting for opponent…';
  } else {
    console.log('Player unready button clicked');
    isReady = false;
    startBtn.textContent = 'Start Game';
    startBtn.classList.remove('cancel-btn');
    socket.emit('playerUnready', { matchId });
    document.getElementById('info').innerText = 'Click "Start Game" when ready';
  }
});

// Player ready state updates
socket.on('playerReadyState', ({ username, ready }) => {
  console.log('Player ready state:', username, ready);
  if (username === you?.username) {
    isReady = ready;
    if (ready) {
      startBtn.textContent = 'Cancel';
      startBtn.classList.add('cancel-btn');
    } else {
      startBtn.textContent = 'Start Game';
      startBtn.classList.remove('cancel-btn');
    }
  }
});

// Display timer (4 seconds to read question)
socket.on('displayTimer', ({ timeLeft }) => {
  console.log('Display timer:', timeLeft);
  document.getElementById('timer').innerText = `${timeLeft}s`;
  document.getElementById('info').innerText = 'Reading question...';
});

// Answer timer
socket.on('answerTimer', ({ timeLeft }) => {
  console.log('Answer timer:', timeLeft);
  document.getElementById('timer').innerText = `${timeLeft}s`;
  document.getElementById('info').innerText = 'Answer the question!';
});

// Question received
socket.on('question', ({ question, index, total }) => {
  console.log('Received question:', index, question);
  currentQuestion = question;
  gamePhase = 'question';
  
  // Update question display
  document.getElementById('question').innerHTML = `
    <div class="question-header">
      <div class="question-index">${index + 1}/${total}</div>
      <div class="question-set">${question.subject || 'Unknown Set'}</div>
      <div class="question-marks">${question.type === 'mcq' || question.type === 'short' ? 'Short answer' : `${question.maxMarks} marks`}</div>
    </div>
    <div class="question-prompt">${question.prompt}</div>
  `;
  
  // Clear answers area
  const answers = document.getElementById('answers');
  answers.innerHTML = '';
  
  // Hide start button
  startBtn.style.display = 'none';
  
  // Show answer area based on question type
  if (question.type === 'mcq') {
    renderMultipleChoice(question);
  } else {
    renderTextInput(question);
  }
});

function renderMultipleChoice(question) {
  const answers = document.getElementById('answers');
  answers.innerHTML = '';
  
  question.choices.forEach((choice, index) => {
    const div = document.createElement('div');
    div.className = 'choice-option';
    
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'answer';
    radio.value = index;
    radio.id = `choice-${index}`;
    
    const label = document.createElement('label');
    label.htmlFor = `choice-${index}`;
    label.textContent = choice.replace(/\*/g, '');
    
    div.appendChild(radio);
    div.appendChild(label);
    answers.appendChild(div);
  });
  
  // Add submit button
  const submitBtn = document.createElement('button');
  submitBtn.textContent = 'Submit';
  submitBtn.className = 'submit-btn';
  submitBtn.disabled = true;
  submitBtn.onclick = () => submitAnswer();
  answers.appendChild(submitBtn);
  
  // Enable submit when option selected
  const radios = answers.querySelectorAll('input[type="radio"]');
  radios.forEach(radio => {
    radio.addEventListener('change', () => {
      submitBtn.disabled = false;
    });
  });
}

function renderTextInput(question) {
  const answers = document.getElementById('answers');
  answers.innerHTML = '';
  
  const input = document.createElement('textarea');
  input.placeholder = 'Type your answer here...';
  input.className = 'answer-textarea';
  if (question.type === 'short') {
    input.rows = 2;
  } else {
    input.rows = 6;
  }
  
  const submitBtn = document.createElement('button');
  submitBtn.textContent = 'Submit';
  submitBtn.className = 'submit-btn';
  submitBtn.disabled = true;
  submitBtn.onclick = () => submitAnswer();
  
  answers.appendChild(input);
  answers.appendChild(submitBtn);
  
  // Enable submit when text entered
  input.addEventListener('input', () => {
    submitBtn.disabled = input.value.trim().length === 0;
  });
}

function submitAnswer() {
  const answers = document.getElementById('answers');
  let answer;
  
  if (currentQuestion.type === 'mcq') {
    const selected = answers.querySelector('input[type="radio"]:checked');
    if (selected) {
      answer = parseInt(selected.value);
    }
  } else {
    const textarea = answers.querySelector('textarea');
    if (textarea) {
      answer = textarea.value.trim();
    }
  }
  
  if (answer !== undefined && answer !== '') {
    console.log('Submitting answer:', answer);
    socket.emit('submitAnswer', { matchId, answer });
    
    // Disable all inputs
    disableAnswerInputs();
  }
}

function disableAnswerInputs() {
  const answers = document.getElementById('answers');
  const inputs = answers.querySelectorAll('input, textarea, button');
  inputs.forEach(input => {
    input.disabled = true;
  });
}

// Answer submitted confirmation
socket.on('answerSubmitted', ({ username, answer, questionType }) => {
  console.log('Answer submitted:', username, answer);
  
  if (username === you?.username) {
    const answers = document.getElementById('answers');
    answers.innerHTML = '';
    
    let displayAnswer = answer;
    if (questionType === 'mcq' && currentQuestion) {
      displayAnswer = currentQuestion.choices[answer].replace(/\*/g, '');
    }
    
    const div = document.createElement('div');
    div.className = 'your-answer';
    div.innerHTML = `<strong>Your answer:</strong> ${displayAnswer}`;
    answers.appendChild(div);
  }
});

// Question results
socket.on('questionResults', ({ correctAnswer, scores, totalScores }) => {
  console.log('Question results:', correctAnswer, scores, totalScores);
  gamePhase = 'next';
  
  const answers = document.getElementById('answers');
  answers.innerHTML = '';
  
  // Show correct answer
  const correctDiv = document.createElement('div');
  correctDiv.className = 'correct-answer';
  correctDiv.innerHTML = `<strong>Correct answer:</strong> ${correctAnswer}`;
  answers.appendChild(correctDiv);
  
  // Show scoring for each player
  Object.entries(scores).forEach(([player, score]) => {
    const scoreDiv = document.createElement('div');
    scoreDiv.className = 'score-display';
    const isZero = score === 0;
    const color = isZero ? 'var(--color-error)' : 'var(--color-text)';
    scoreDiv.innerHTML = `<span style="color: ${color}">${player}: ${score} points</span>`;
    answers.appendChild(scoreDiv);
  });
  
  // Show next button after delay
  setTimeout(() => {
    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Next Question';
    nextBtn.className = 'next-btn';
    nextBtn.onclick = () => {
      socket.emit('nextQuestion', { matchId });
    };
    answers.appendChild(nextBtn);
  }, 2000);
});

// Match over
socket.on('matchOver', ({ scores }) => {
  console.log('Match over:', scores);
  gamePhase = 'ended';
  
  document.getElementById('info').innerText = 'Match Over!';
  document.getElementById('timer').innerText = '';
  
  const answers = document.getElementById('answers');
  answers.innerHTML = '';
  
  const finalDiv = document.createElement('div');
  finalDiv.className = 'final-scores';
  finalDiv.innerHTML = '<h3>Final Scores:</h3>';
  
  Object.entries(scores).forEach(([player, score]) => {
    const scoreDiv = document.createElement('div');
    scoreDiv.innerHTML = `<strong>${player}:</strong> ${score} points`;
    finalDiv.appendChild(scoreDiv);
  });
  
  answers.appendChild(finalDiv);
  
  // Clear stored match data
  sessionStorage.removeItem('currentMatch');
});

// Socket connection events
socket.on('connect', () => {
  console.log('Socket connected');
});

socket.on('disconnect', () => {
  console.log('Socket disconnected');
});

socket.on('connect_error', (error) => {
  console.error('Socket connection error:', error);
});
