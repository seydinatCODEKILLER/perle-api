import DashboardService from "../services/statistiques/dashboard.service.js";

export default class DashboardController {
  constructor() {
    this.service = new DashboardService();
  }

  async getAdminDashboard(req, res) {
    try {
      const { organizationId } = req.params;
      const userId = req.user.id;

      const dashboard = await this.service.getAdminDashboard(
        organizationId,
        userId
      );

      return res.success(dashboard, "Dashboard ADMIN récupéré avec succès");
    } catch (error) {
      const statusCode = error.message.includes("Permissions") ? 403 : 400;
      return res.error(error.message, statusCode);
    }
  }

  async getFinancialManagerDashboard(req, res) {
    try {
      const { organizationId } = req.params;
      const userId = req.user.id;

      const dashboard = await this.service.getFinancialManagerDashboard(
        organizationId,
        userId
      );

      return res.success(dashboard, "Dashboard FINANCIAL MANAGER récupéré avec succès");
    } catch (error) {
      const statusCode = error.message.includes("Permissions") ? 403 : 400;
      return res.error(error.message, statusCode);
    }
  }

  async getMemberDashboard(req, res) {
    try {
      const { organizationId } = req.params;
      const userId = req.user.id;
      const { membershipId } = req.query;

      if (!membershipId) {
        return res.error("L'ID du membership est requis", 400);
      }

      const dashboard = await this.service.getMemberDashboard(
        organizationId,
        membershipId,
        userId
      );

      return res.success(dashboard, "Dashboard MEMBRE récupéré avec succès");
    } catch (error) {
      const statusCode = error.message.includes("Permissions") ? 403 : 400;
      return res.error(error.message, statusCode);
    }
  }

  async getAutoDashboard(req, res) {
    try {
      const { organizationId } = req.params;
      const userId = req.user.id;

      const dashboard = await this.service.getAutoDashboard(
        organizationId,
        userId
      );

      return res.success(dashboard, "Dashboard récupéré avec succès");
    } catch (error) {
      return res.error(error.message, 400);
    }
  }
}