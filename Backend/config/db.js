const mongoose = require("mongoose");

/**
 * Connects to MongoDB Atlas using MONGO_URI (or MONGO_URL fallback).
 */
async function ConnectDB() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGO_URL;

  if (!mongoUri) {
    throw new Error(
      "MongoDB Connection Error: Neither MONGO_URI nor MONGO_URL environment variable is set."
    );
  }

  try {
    const conn = await mongoose.connect(mongoUri);
    console.log(`[MongoDB] Connected successfully to host: ${conn.connection.host}`);
  } catch (error) {
    console.error("[MongoDB] Connection Error:", error.message);
    throw error;
  }
}

module.exports = ConnectDB;
