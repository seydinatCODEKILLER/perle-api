import logger from "../config/logger.js";

/**
 * Middleware pour logger toutes les requêtes HTTP
 * Enregistre : méthode, URL, durée, statut
 */
export const httpLogger = (req, res, next) => {
  const startTime = Date.now();

  // Capturer la fin de la réponse
  const originalSend = res.send;
  const originalJson = res.json;

  res.send = function (data) {
    res.send = originalSend;
    const duration = Date.now() - startTime;
    logger.logRequest(req, res, duration);
    return originalSend.call(this, data);
  };

  res.json = function (data) {
    res.json = originalJson;
    const duration = Date.now() - startTime;
    logger.logRequest(req, res, duration);
    return originalJson.call(this, data);
  };

  next();
};

/**
 * Middleware pour logger les erreurs non gérées
 */
export const errorLogger = (err, req, res, next) => {
  logger.logError(err, {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userId: req.user?.id,
  });

  next(err);
};

export default httpLogger;
