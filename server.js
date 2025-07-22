const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const path = require('path');

// serve login page at /login
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'html', 'login.html'));
});

// serve dashboard at /dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'html', 'dashboard.html'));
});

// serve dashboard at /dashboard
app.get('/landing', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'html', 'landing.html'));
});

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static("public"));

// In-memory message store
const messages = [];

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Send current messages to the newly connected client
  socket.emit("initMessages", messages);

  // Listen for new messages
  socket.on("newMessage", (data) => {
    // data = { name: string, message: string }
    const msgObj = { name: data.name, message: data.message, time: new Date() };
    messages.push(msgObj);

    // Broadcast new message to all clients
    io.emit("messageBroadcast", msgObj);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
