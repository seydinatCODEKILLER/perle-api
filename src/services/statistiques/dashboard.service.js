import FinancialDashboardService from "./financial.dashboard.service.js";
import MemberDashboardService from "./member.dashboard.service.js";
import AdminDashboardService from "./admin.dashboard.service.js.js";
import { prisma } from "../../config/database.js";

export default class DashboardService {
  constructor() {
    this.adminService = new AdminDashboardService();
    this.financialService = new FinancialDashboardService();
    this.memberService = new MemberDashboardService();
  }

  /**
   * Récupère le membership de l'utilisateur dans l'organisation
   * @private
   */
  async #getCurrentMembership(organizationId, userId) {
    const membership = await prisma.membership.findFirst({
      where: {
        userId,
        organizationId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        role: true,
        status: true,
        memberNumber: true,
        userId: true,
      },
    });

    if (!membership) {
      throw new Error("Vous n'êtes pas membre actif de cette organisation");
    }

    return membership;
  }

  /**
   * Dashboard de GESTION (Organization-level)
   * Accessible par ADMIN et FINANCIAL_MANAGER uniquement
   */
  async getManagementDashboard(organizationId, currentUserId) {
    const membership = await this.#getCurrentMembership(
      organizationId,
      currentUserId,
    );

    // Vérifier les permissions
    if (!["ADMIN", "FINANCIAL_MANAGER"].includes(membership.role)) {
      throw new Error(
        "Permissions insuffisantes. Seuls les ADMIN et FINANCIAL_MANAGER peuvent accéder à l'espace de gestion.",
      );
    }

    // Retourner le dashboard approprié selon le rôle
    if (membership.role === "ADMIN") {
      return await this.adminService.getDashboardData(organizationId);
    } else {
      return await this.financialService.getDashboardData(organizationId);
    }
  }

  /**
   * Dashboard PERSONNEL (Member-level)
   * ✅ Accessible par TOUS les rôles (ADMIN, FINANCIAL_MANAGER, MEMBER)
   * Car ADMIN et FINANCIAL_MANAGER sont aussi des membres avec leurs propres cotisations
   */
  async getPersonalDashboard(organizationId, currentUserId) {
    const membership = await this.#getCurrentMembership(
      organizationId,
      currentUserId,
    );

    // ✅ Tous les rôles peuvent accéder à leur espace personnel
    // Car même un ADMIN a ses propres cotisations et dettes
    return await this.memberService.getDashboardData(
      organizationId,
      membership.id,
    );
  }

  /**
   * Route AUTO - Détecte le contexte et retourne le bon dashboard
   * @param {string} space - 'management' | 'personal'
   */
  async getAutoDashboard(organizationId, currentUserId, space = "management") {
    const membership = await this.#getCurrentMembership(
      organizationId,
      currentUserId,
    );

    // ✅ Si espace personnel demandé, tout le monde y a accès
    if (space === "personal") {
      return await this.memberService.getDashboardData(
        organizationId,
        membership.id,
      );
    }

    // ✅ Si espace gestion demandé, vérifier les permissions
    if (space === "management") {
      if (!["ADMIN", "FINANCIAL_MANAGER"].includes(membership.role)) {
        throw new Error(
          "Vous n'avez pas accès à l'espace de gestion. Redirection vers votre espace personnel.",
        );
      }

      if (membership.role === "ADMIN") {
        return await this.adminService.getDashboardData(organizationId);
      } else {
        return await this.financialService.getDashboardData(organizationId);
      }
    }

    throw new Error(`Espace non reconnu: ${space}`);
  }

  /**
   * Route AUTO (Legacy) - Pour compatibilité
   * Redirige automatiquement vers le bon espace selon le rôle
   */
  async getDefaultDashboard(organizationId, currentUserId) {
    const membership = await this.#getCurrentMembership(
      organizationId,
      currentUserId,
    );

    // MEMBER simple -> Espace personnel
    if (membership.role === "MEMBER") {
      return {
        redirectTo: "personal",
        data: await this.memberService.getDashboardData(
          organizationId,
          membership.id,
        ),
      };
    }

    // ADMIN et FINANCIAL_MANAGER -> Espace gestion par défaut
    if (["ADMIN", "FINANCIAL_MANAGER"].includes(membership.role)) {
      const data =
        membership.role === "ADMIN"
          ? await this.adminService.getDashboardData(organizationId)
          : await this.financialService.getDashboardData(organizationId);

      return {
        redirectTo: "management",
        data,
      };
    }

    throw new Error(`Rôle non reconnu: ${membership.role}`);
  }
}
