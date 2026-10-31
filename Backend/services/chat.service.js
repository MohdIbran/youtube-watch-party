const Message = require("../models/Message");
const Room = require("../models/Room");

/**
 * Escapes HTML characters to sanitize user input and prevent XSS.
 * @param {string} str 
 * @returns {string}
 */
const sanitizeMessage = (str) => {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
};

/**
 * Saves a new chat message to MongoDB.
 * 
 * @param {Object} params
 * @param {string} params.roomCode
 * @param {string|null} params.userId
 * @param {string} params.username
 * @param {string} params.message
 * @param {"user"|"system"} [params.type="user"]
 */
const saveMessage = async ({ roomCode, userId, username, message, type = "user" }) => {
  if (!roomCode) {
    throw new Error("roomCode is required.");
  }

  const normalizedCode = roomCode.toUpperCase().trim();
  const room = await Room.findOne({ roomCode: normalizedCode, isActive: true });
  if (!room) {
    const err = new Error("Room not found or no longer active.");
    err.statusCode = 404;
    throw err;
  }

  // If this is a user message, validate room membership
  if (type === "user") {
    if (!userId) {
      const err = new Error("Authentication required to send chat messages.");
      err.statusCode = 401;
      throw err;
    }

    const isMember = room.participants.some((p) => {
      const pId = p.user && (p.user._id ? p.user._id.toString() : p.user.toString());
      return pId === userId.toString();
    });

    if (!isMember) {
      const err = new Error("Forbidden: You must be a member of this room to send messages.");
      err.statusCode = 403;
      throw err;
    }

    if (!message || typeof message !== "string" || !message.trim()) {
      const err = new Error("Message cannot be empty.");
      err.statusCode = 400;
      throw err;
    }

    const trimmed = message.trim();
    if (trimmed.length > 500) {
      const err = new Error("Message exceeds the maximum limit of 500 characters.");
      err.statusCode = 400;
      throw err;
    }

    const sanitized = sanitizeMessage(trimmed);

    const doc = await Message.create({
      room: room._id,
      roomCode: normalizedCode,
      sender: userId,
      username: username || "User",
      message: sanitized,
      type: "user",
      timestamp: new Date(),
    });

    return doc;
  } else {
    // System message
    const trimmed = (message || "").trim();
    const sanitized = sanitizeMessage(trimmed);

    const doc = await Message.create({
      room: room._id,
      roomCode: normalizedCode,
      sender: null,
      username: "System",
      message: sanitized,
      type: "system",
      timestamp: new Date(),
    });

    return doc;
  }
};

/**
 * Retrieves recent chat history for a room.
 * 
 * @param {string} roomCode 
 * @param {number} [limit=50] 
 */
const getRecentMessages = async (roomCode, limit = 50) => {
  if (!roomCode) {
    throw new Error("roomCode is required.");
  }

  const normalizedCode = roomCode.toUpperCase().trim();
  const room = await Room.findOne({ roomCode: normalizedCode, isActive: true });
  if (!room) {
    const err = new Error("Room not found or no longer active.");
    err.statusCode = 404;
    throw err;
  }

  // Fetch recent messages up to limit, in chronological order
  const messages = await Message.find({ roomCode: normalizedCode })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate("sender", "username email avatar")
    .lean();

  // Return in ascending chronological order for the client display
  return messages.reverse();
};

module.exports = {
  sanitizeMessage,
  saveMessage,
  getRecentMessages,
};
