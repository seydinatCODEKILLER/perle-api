// config/rateLimiter.js

import rateLimit from "express-rate-limit";

/**
 * Fonction pour extraire la vraie IP du client
 * Sur Render/Heroku, l'IP est dans X-Forwarded-For
 */
const getClientIp = (req) => {
  // 1. X-Forwarded-For (proxy)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // Prendre la première IP (client original)
    return forwarded.split(',')[0].trim();
  }
  
  // 2. X-Real-IP (certains proxies)
  if (req.headers['x-real-ip']) {
    return req.headers['x-real-ip'];
  }
  
  // 3. Fallback sur req.ip (Express avec trust proxy)
  return req.ip;
};

/**
 * Rate limiter général pour routes publiques
 * 100 requêtes par 15 minutes par IP
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  
  // ✅ Utiliser la vraie IP du client
  keyGenerator: (req) => {
    const ip = getClientIp(req);
    console.log("🔍 Rate limit - IP:", ip, "Path:", req.path);
    return ip;
  },
  
  standardHeaders: true,
  legacyHeaders: false,
  
  // ✅ Pas besoin de validate car on gère manuellement avec keyGenerator
  validate: false,
  
  message: {
    success: false,
    message: "Trop de requêtes, veuillez réessayer plus tard",
  },
  
  skip: (req) => {
    const exemptedPaths = [
      "/auth/me",
      "/auth/refresh-token",
      "/auth/refresh",
    ];
    return exemptedPaths.some(path => req.path.endsWith(path));
  },
});

/**
 * Rate limiter strict pour login
 * 5 tentatives par 15 minutes par IP
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  
  // ✅ Utiliser la vraie IP du client
  keyGenerator: (req) => {
    const ip = getClientIp(req);
    console.log("🔐 Auth rate limit - IP:", ip);
    return ip;
  },
  
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  
  skipSuccessfulRequests: false,
  
  message: {
    success: false,
    message: "Trop de tentatives de connexion. Réessayez dans 15 minutes",
  },
});

/**
 * Rate limiter pour la création de comptes
 * 3 créations par heure par IP
 */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  
  keyGenerator: (req) => getClientIp(req),
  
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  
  message: {
    success: false,
    message: "Trop de tentatives de création de compte. Réessayez dans 1 heure",
  },
});

/**
 * Rate limiter pour le refresh token
 * 30 requêtes par 15 minutes
 */
export const refreshTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  
  keyGenerator: (req) => getClientIp(req),
  
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  
  message: {
    success: false,
    message: "Trop de tentatives de rafraîchissement de token",
  },
});

/**
 * Rate limiter pour les uploads
 * 20 uploads par heure
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  
  keyGenerator: (req) => getClientIp(req),
  
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  
  message: {
    success: false,
    message: "Trop d'uploads. Réessayez plus tard",
  },
});

/**
 * Rate limiter pour les opérations CRUD courantes
 * 200 requêtes par 15 minutes
 */
export const crudLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  
  keyGenerator: (req) => getClientIp(req),
  
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  
  message: {
    success: false,
    message: "Trop de requêtes. Veuillez ralentir",
  },
});