const socket = io();

const nameForm = document.getElementById("nameForm");
const nameInput = document.getElementById("nameInput");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const chatBox = document.getElementById("chatBox");

let userName = "";

// Helper to display a message
function addMessage({ name, message, time }) {
  const timeString = new Date(time).toLocaleTimeString();
  const p = document.createElement("p");
  p.textContent = `[${timeString}] ${name}: ${message}`;
  chatBox.appendChild(p);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// When user submits name
nameForm.addEventListener("submit", (e) => {
  e.preventDefault();
  userName = nameInput.value.trim();
  if (userName) {
    nameForm.style.display = "none";
    messageForm.style.display = "block";
  }
});

// When user sends a message
messageForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const message = messageInput.value.trim();
  if (message) {
    socket.emit("newMessage", { name: userName, message });
    messageInput.value = "";
  }
});

// Load existing messages on connect
socket.on("initMessages", (messages) => {
  chatBox.innerHTML = ""; // clear chat
  messages.forEach(addMessage);
});

// Receive new message broadcasts
socket.on("messageBroadcast", (msgObj) => {
  addMessage(msgObj);
});
