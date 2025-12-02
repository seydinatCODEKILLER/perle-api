// middlewares/OrganizationMiddleware.js
import { prisma } from "../config/database.js";

export default class OrganizationMiddleware {
  // Vérifier que l'utilisateur a accès à l'organisation
  async checkOrganizationAccess(req, res, next) {
    try {
      const organizationId = req.params.id;
      const userId = req.user.id;

      const membership = await prisma.membership.findFirst({
        where: {
          userId,
          organizationId,
          status: "ACTIVE",
        },
      });

      if (!membership) {
        return res.error("Accès non autorisé à cette organisation", 403);
      }

      req.membership = membership;
      next();
    } catch (error) {
      return res.error("Erreur de vérification d'accès", 500);
    }
  }

  // Vérifier les permissions ADMIN
  async requireAdminAccess(req, res, next) {
    try {
      const organizationId = req.params.id;
      const userId = req.user.id;

      const membership = await prisma.membership.findFirst({
        where: {
          userId,
          organizationId,
          status: "ACTIVE",
          role: { in: ["ADMIN"] },
        },
      });

      if (!membership) {
        return res.error("Permissions administrateur requises", 403);
      }

      req.membership = membership;
      next();
    } catch (error) {
      return res.error("Erreur de vérification des permissions", 500);
    }
  }

  // Vérifier que l'utilisateur est propriétaire
  async requireOwnerAccess(req, res, next) {
    try {
      const organizationId = req.params.id;
      const userId = req.user.id;

      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { ownerId: true },
      });

      if (!organization) {
        return res.error("Organisation non trouvée", 404);
      }

      if (organization.ownerId !== userId) {
        return res.error("Accès réservé au propriétaire", 403);
      }

      next();
    } catch (error) {
      return res.error("Erreur de vérification des droits", 500);
    }
  }
}
