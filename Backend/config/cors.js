/**
 * Shared CORS Configuration for Express and Socket.IO
 * Supports:
 *  - http://localhost:5173 (and any local dev port)
 *  - Vercel production and preview domains (*.vercel.app)
 *  - Any origins configured in CLIENT_URL (comma-separated)
 *  - Non-wildcard origin reflection to ensure credentials: true works safely
 */

const getAllowedOrigins = () => {
  const envOrigins = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(",").map((url) => url.trim()).filter(Boolean)
    : [];
  return envOrigins;
};

const isOriginAllowed = (origin) => {
  // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
  if (!origin) return true;

  const envOrigins = getAllowedOrigins();

  // Explicit origins from CLIENT_URL
  if (envOrigins.includes(origin) || envOrigins.includes("*")) {
    return true;
  }

  // Local development origins (localhost / 127.0.0.1 on any port)
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return true;
  }

  // Vercel deployment and preview domains
  if (/^https:\/\/[a-zA-Z0-9_.-]+\.vercel\.app$/.test(origin)) {
    return true;
  }

  return false;
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      // Dynamically reflect the caller origin to strictly satisfy credentials: true
      callback(null, origin || true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

module.exports = {
  corsOptions,
  isOriginAllowed,
};
