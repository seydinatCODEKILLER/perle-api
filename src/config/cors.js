// config/cors.config.js

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
      "http://localhost:5173", // ✅ Ajouté pour tester
      "http://localhost:3000",
      "http://127.0.0.1:5173", // ✅ Ajouté aussi
    ].filter(Boolean),
    credentials: true,
  },
};

export const getCorsOptions = () => {
  const config = corsConfig[env.NODE_ENV] || corsConfig.development;

  return {
    origin: (origin, callback) => {
      // ✅ Debug logs
      console.log("🔍 CORS Check - Origin:", origin);
      console.log("🔍 Allowed origins:", config.origin);
      
      if (!origin) {
        console.log("✅ No origin - ALLOWED");
        return callback(null, true);
      }

      if (config.origin.includes(origin)) {
        console.log("✅ Origin ALLOWED");
        callback(null, true);
      } else {
        console.error("❌ Origin BLOCKED:", origin);
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
