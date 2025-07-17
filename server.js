const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

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
