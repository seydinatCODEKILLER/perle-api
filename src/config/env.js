// config/env.js

import "dotenv/config";

export const env = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || "development",
  DATABASE_URL: process.env.DATABASE_URL,
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_DURATION: process.env.JWT_DURATION,
  HOST: process.env.NODE_ENV === "production" ? process.env.HOST : "localhost",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_REFRESH_DURATION: process.env.JWT_REFRESH_DURATION,
  
  FRONTEND_URL_DEV: process.env.FRONTEND_URL_DEV || "http://localhost:5173",
  FRONTEND_URL_PROD: process.env.FRONTEND_URL_PROD,
  
  get FRONTEND_URL() {
    return this.NODE_ENV === "production" 
      ? this.FRONTEND_URL_PROD 
      : this.FRONTEND_URL_DEV;
  },
};