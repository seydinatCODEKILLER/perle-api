import rateLimit from "express-rate-limit";

/**
 * Rate limiter général pour toutes les routes API
 * 100 requêtes par 15 minutes par IP
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requêtes max
  message: {
    success: false,
    message: "Trop de requêtes, veuillez réessayer plus tard",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter strict pour les routes d'authentification
 * Protège contre les attaques brute force
 * 5 tentatives par 15 minutes par IP
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 tentatives max
  message: {
    success: false,
    message: "Trop de tentatives de connexion. Réessayez dans 15 minutes",
  },
  skipSuccessfulRequests: false, // Compte toutes les requêtes
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter pour la création de comptes
 * Empêche le spam de création de comptes
 * 3 créations par heure par IP
 */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 3, // 3 créations max
  message: {
    success: false,
    message: "Trop de tentatives de création de compte. Réessayez dans 1 heure",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter pour le refresh token
 * 10 requêtes par 15 minutes
 */
export const refreshTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    success: false,
    message: "Trop de tentatives de rafraîchissement de token",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter pour les uploads
 * 20 uploads par heure
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 20,
  message: {
    success: false,
    message: "Trop d'uploads. Réessayez plus tard",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter pour les opérations CRUD courantes
 * 50 requêtes par 15 minutes
 */
export const crudLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  message: {
    success: false,
    message: "Trop de requêtes. Veuillez ralentir",
  },
  standardHeaders: true,
  legacyHeaders: false,
});