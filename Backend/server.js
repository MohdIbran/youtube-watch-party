const dns = require("node:dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]);

require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");

const app = require("./app");
const ConnectDB = require("./config/db");
const setupSocket = require("./sockets/socket");

const server = http.createServer(app);

// Allowed origins for Socket.IO
const clientOrigin = process.env.CLIENT_URL || "*";

// Socket.IO setup supporting both WebSocket and polling transports
const io = new Server(server, {
  cors: {
    origin: clientOrigin === "*" ? "*" : clientOrigin.split(",").map((url) => url.trim()),
    methods: ["GET", "POST", "PATCH", "DELETE"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

// Attach io to Express app for use in REST controllers
app.set("io", io);

// Initialize socket event handlers & auth
setupSocket(io);

// Start server
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await ConnectDB();
    server.listen(PORT, () => {
      console.log(`===============================================`);
      console.log(` YouTube Watch Party Backend is running on port: ${PORT}`);
      console.log(` Health check: http://localhost:${PORT}/health`);
      console.log(` Socket.IO endpoint ready`);
      console.log(`===============================================`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();

module.exports = { app, server, io };