// middlewares/FormDataParser.js

/**
 * Middleware pour parser les données FormData imbriquées
 */
export const parseNestedFormData = (req, res, next) => {
  if (!req.body || typeof req.body !== "object") {
    return next();
  }

  const parsed = {};

  Object.keys(req.body).forEach((key) => {
    // Détecter les clés imbriquées comme "provisionalData[firstName]"
    const match = key.match(/^(\w+)\[(.+)\]$/);

    if (match) {
      const [, parentKey, childKey] = match;

      // Créer l'objet parent si nécessaire
      if (!parsed[parentKey]) {
        parsed[parentKey] = {};
      }

      // Ajouter la valeur dans l'objet imbriqué
      parsed[parentKey][childKey] = req.body[key];
    } else {
      // Clé simple
      parsed[key] = req.body[key];
    }
  });

  // Remplacer req.body par la version parsée
  req.body = parsed;

  next();
};