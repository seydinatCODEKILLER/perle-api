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
  EMAIL_FROM: process.env.EMAIL_FROM,
  FRONTEND_URL: process.env.FRONTEND_URL,
  SMTP_HOST: process.env.SMTP_HOST || "smtp.gmail.com",
  SMTP_PORT: process.env.SMTP_PORT || 587,
  SMTP_SECURE: process.env.SMTP_SECURE || "false",
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  BREVO_API_KEY: process.env.BREVO_API_KEY,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  ALLOWED_AI_USER_ID: process.env.ALLOWED_AI_USER_ID,
};