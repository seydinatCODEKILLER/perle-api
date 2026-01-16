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

  async getAdminDashboard(organizationId, currentUserId) {
    // Vérifier que l'utilisateur est ADMIN de cette organisation
    const currentMembership = await prisma.membership.findFirst({
      where: {
        userId: currentUserId,
        organizationId,
        status: "ACTIVE",
        role: "ADMIN",
      },
    });

    if (!currentMembership) {
      throw new Error("Permissions insuffisantes pour accéder au dashboard ADMIN");
    }

    return await this.adminService.getDashboardData(organizationId);
  }

  async getFinancialManagerDashboard(organizationId, currentUserId) {
    // Vérifier que l'utilisateur est FINANCIAL_MANAGER ou ADMIN
    const currentMembership = await prisma.membership.findFirst({
      where: {
        userId: currentUserId,
        organizationId,
        status: "ACTIVE",
        role: { in: ["ADMIN", "FINANCIAL_MANAGER"] },
      },
    });

    if (!currentMembership) {
      throw new Error("Permissions insuffisantes pour accéder au dashboard FINANCIAL_MANAGER");
    }

    return await this.financialService.getDashboardData(organizationId);
  }

  async getMemberDashboard(organizationId, membershipId, currentUserId) {
    // Vérifier que l'utilisateur est le membre ou a les permissions
    const currentMembership = await prisma.membership.findFirst({
      where: {
        userId: currentUserId,
        organizationId,
        status: "ACTIVE",
        id: membershipId,
      },
    });

    if (!currentMembership) {
      throw new Error("Permissions insuffisantes pour accéder au dashboard membre");
    }

    return await this.memberService.getDashboardData(organizationId, membershipId);
  }

  async getAutoDashboard(organizationId, currentUserId) {
    // Récupérer le rôle de l'utilisateur dans cette organisation
    const currentMembership = await prisma.membership.findFirst({
      where: {
        userId: currentUserId,
        organizationId,
        status: "ACTIVE",
      },
      select: {
        role: true,
        id: true,
      },
    });

    if (!currentMembership) {
      throw new Error("Vous n'êtes pas membre de cette organisation");
    }

    switch (currentMembership.role) {
      case "ADMIN":
        return await this.getAdminDashboard(organizationId, currentUserId);
      
      case "FINANCIAL_MANAGER":
        return await this.getFinancialManagerDashboard(organizationId, currentUserId);
      
      case "MEMBER":
        return await this.getMemberDashboard(organizationId, currentMembership.id, currentUserId);
      
      default:
        throw new Error("Rôle non reconnu");
    }
  }
}