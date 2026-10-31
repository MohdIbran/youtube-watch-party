const crypto = require("crypto");

/**
 * Generates a clean, unique uppercase alphanumeric room code.
 * Excludes ambiguous characters (0, O, 1, I) to prevent user confusion.
 * @param {number} length - Length of the generated code (default 6)
 * @returns {string} Unique room code e.g. "7K9M2P"
 */
const generateRoomCode = (length = 6) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
};

module.exports = generateRoomCode;
