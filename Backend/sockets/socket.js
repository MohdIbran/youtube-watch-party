const { verifyToken } = require("../utils/token");
const registerRoomHandlers = require("./room.socket");

/**
 * Initializes Socket.IO with authentication middleware and event handlers.
 * @param {import("socket.io").Server} io 
 */
const setupSocket = (io) => {
  // Socket.IO Authentication Middleware
  io.use((socket, next) => {
    try {
      const authHeader = socket.handshake.headers.authorization;
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token ||
        (authHeader && authHeader.startsWith("Bearer ")
          ? authHeader.split(" ")[1]
          : null);

      if (!token) {
        return next(
          new Error("Authentication error: Bearer token is required to connect.")
        );
      }

      const decoded = verifyToken(token);
      socket.user = {
        id: decoded.id,
        username: decoded.username,
        email: decoded.email,
      };

      next();
    } catch (err) {
      return next(
        new Error(`Authentication error: ${err.message || "Invalid token"}`)
      );
    }
  });

  io.on("connection", (socket) => {
    console.log(`[Socket.IO] Authenticated user connected: ${socket.user.username} (${socket.id})`);

    // Register all room event handlers
    registerRoomHandlers(io, socket);

    socket.on("error", (err) => {
      console.error(`[Socket.IO] Error for socket ${socket.id}:`, err.message);
    });
  });
};

module.exports = setupSocket;