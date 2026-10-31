const jwt = require("jsonwebtoken");

/**
 * Generates a signed JWT for a given user payload.
 * @param {Object} user 
 * @returns {string} JWT token
 */
const generateToken = (user) => {
  const secret = process.env.JWT_SECRET || "youtube_watch_party_jwt_secret_key_default";
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";

  return jwt.sign(
    {
      id: user._id || user.id,
      username: user.username,
      email: user.email,
    },
    secret,
    { expiresIn }
  );
};

/**
 * Verifies a JWT token.
 * @param {string} token 
 * @returns {Object} Decoded payload
 */
const verifyToken = (token) => {
  const secret = process.env.JWT_SECRET || "youtube_watch_party_jwt_secret_key_default";
  return jwt.verify(token, secret);
};

module.exports = {
  generateToken,
  verifyToken,
};
