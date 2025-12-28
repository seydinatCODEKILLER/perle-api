import "dotenv/config"

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
  FRONTEND_URL: process.env.FRONTEND_URL,
};