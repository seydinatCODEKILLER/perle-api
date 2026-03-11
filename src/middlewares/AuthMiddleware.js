import TokenGenerator from "../config/jwt.js";
import { prisma } from "../config/database.js";
import { CookieManager } from "../utils/cookie.utils.js";

export default class AuthMiddleware {
  constructor() {
    this.tokenGenerator = new TokenGenerator();
  }

  protect() {
    return async (req, res, next) => {
      try {
        let token;

        // ✅ Priorité 1: Vérifier les cookies
        token = CookieManager.getAccessToken(req);

        // ✅ Priorité 2: Vérifier le header Authorization (pour Postman, mobile, etc.)
        if (!token && req.headers.authorization?.startsWith("Bearer")) {
          token = req.headers.authorization.split(" ")[1];
        }

        if (!token) {
          return res.error("Accès non autorisé. Veuillez vous connecter.", 401);
        }

        const decoded = this.tokenGenerator.verify(token);

        const currentUser = await prisma.user.findUnique({
          where: { id: decoded.id },
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            canCreateOrganization: true,
          },
        });

        if (!currentUser) {
          return res.error(
            "Le token appartient à un utilisateur qui n'existe plus.",
            401
          );
        }

        if (!currentUser.isActive) {
          return res.error("Votre compte a été désactivé.", 403);
        }

        req.user = currentUser;
        next();
      } catch (error) {
        // ✅ Supprimer les cookies si le token est invalide
        CookieManager.clearAuthCookies(res);
        return res.error("Token invalide.", 401);
      }
    };
  }

  restrictTo(...roles) {
    return (req, res, next) => {
      if (!roles.includes(req.user.role)) {
        return res.error(
          "Vous n'avez pas la permission d'effectuer cette action.",
          403
        );
      }
      next();
    };
  }

  checkOrganizationAccess() {
    return async (req, res, next) => {
      try {
        const organizationId =
          req.params.organizationId || req.body.organizationId;

        if (!organizationId) {
          return next();
        }

        const membership = await prisma.membership.findFirst({
          where: {
            userId: req.user.id,
            organizationId: organizationId,
            status: "ACTIVE",
          },
        });

        if (!membership && req.user.role !== "SUPER_ADMIN") {
          return res.error("Accès non autorisé à cette organisation.", 403);
        }

        req.membership = membership;
        next();
      } catch (error) {
        return res.error("Erreur de vérification d'accès.", 500);
      }
    };
  }
}