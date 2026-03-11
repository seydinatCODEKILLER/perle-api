
import { env } from "./env.js";

export const corsConfig = {
  development: {
    origin: [
      env.FRONTEND_URL_DEV,
      "http://localhost:5173",
      "http://localhost:3000",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:3000",
    ],
    credentials: true,
  },
  production: {
    origin: [
      env.FRONTEND_URL_PROD,
    ].filter(Boolean),
    credentials: true,
  },
};

export const getCorsOptions = () => {
  const config = corsConfig[env.NODE_ENV] || corsConfig.development;

  return {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (config.origin.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Not allowed by CORS: ${origin}`));
      }
    },
    credentials: config.credentials,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
    ],
    exposedHeaders: ["Set-Cookie"],
    maxAge: 86400,
  };
};