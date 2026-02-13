import pino from "pino";
import { env } from "./env.js";

/**
 * Configuration du logger selon l'environnement
 */
const isProduction = env.NODE_ENV === "production";
const isDevelopment = env.NODE_ENV === "development";

/**
 * Configuration de base du logger
 */
const baseConfig = {
  level: env.LOG_LEVEL || (isProduction ? "info" : "debug"),

  // Informations de base à inclure dans chaque log
  base: {
    env: env.NODE_ENV,
    app: "gestion-api",
  },

  // Timestamp automatique
  timestamp: pino.stdTimeFunctions.isoTime,

  // Sérialisation personnalisée pour les objets communs
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      path: req.path,
      parameters: req.params,
      query: req.query,
      // Ne pas logger le body pour éviter les données sensibles
      headers: {
        host: req.headers.host,
        "user-agent": req.headers["user-agent"],
        "content-type": req.headers["content-type"],
      },
      remoteAddress: req.ip || req.connection?.remoteAddress,
    }),

    res: (res) => ({
      statusCode: res.statusCode,
      headers: {
        "content-type": res.getHeader("content-type"),
        "content-length": res.getHeader("content-length"),
      },
    }),

    err: pino.stdSerializers.err,
  },

  // Redaction de données sensibles
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "password",
      "*.password",
      "*.token",
      "*.accessToken",
      "*.refreshToken",
      "email", // Optionnel selon RGPD
      "phone", // Optionnel selon RGPD
    ],
    censor: "[REDACTED]",
  },
};

/**
 * Configuration pour le développement (pretty print)
 */
const developmentConfig = {
  ...baseConfig,
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname",
      singleLine: false,
      messageFormat: "{levelLabel} - {msg}",
      errorLikeObjectKeys: ["err", "error"],
    },
  },
};

/**
 * Configuration pour la production (JSON)
 */
const productionConfig = {
  ...baseConfig,
};

/**
 * Logger principal
 */
const logger = isDevelopment ? pino(developmentConfig) : pino(productionConfig);

/**
 * Helper pour logger les requêtes HTTP
 */
logger.logRequest = (req, res, duration) => {
  const log = {
    req,
    res,
    duration: `${duration}ms`,
  };

  if (res.statusCode >= 500) {
    logger.error(log, "HTTP Request Error");
  } else if (res.statusCode >= 400) {
    logger.warn(log, "HTTP Request Warning");
  } else {
    logger.info(log, "HTTP Request");
  }
};

/**
 * Helper pour logger les erreurs avec contexte
 */
logger.logError = (error, context = {}) => {
  logger.error(
    {
      err: error,
      ...context,
    },
    error.message || "An error occurred",
  );
};

/**
 * Helper pour logger les événements métier
 */
logger.logEvent = (eventName, data = {}) => {
  logger.info(
    {
      event: eventName,
      ...data,
    },
    `Event: ${eventName}`,
  );
};

/**
 * Helper pour logger les performances
 */
logger.logPerformance = (operation, duration, metadata = {}) => {
  logger.info(
    {
      operation,
      duration: `${duration}ms`,
      ...metadata,
    },
    `Performance: ${operation}`,
  );
};

export default logger;
