import DashboardService from "../services/statistiques/dashboard.service.js";

export default class DashboardController {
  constructor() {
    this.service = new DashboardService();
  }

  /**
   * Dashboard de GESTION
   * Route: GET /organizations/:organizationId/dashboard/management
   */
  async getManagementDashboard(req, res) {
    try {
      const { organizationId } = req.params;
      const userId = req.user.id;

      const dashboard = await this.service.getManagementDashboard(
        organizationId,
        userId,
      );

      return res.success(
        dashboard,
        "Dashboard de gestion récupéré avec succès",
      );
    } catch (error) {
      const statusCode = error.message.includes("Permissions") ? 403 : 400;
      return res.error(error.message, statusCode);
    }
  }

  /**
   * Dashboard PERSONNEL
   * Route: GET /organizations/:organizationId/dashboard/personal
   * ✅ Accessible par TOUS les rôles
   */
  async getPersonalDashboard(req, res) {
    try {
      const { organizationId } = req.params;
      const userId = req.user.id;

      const dashboard = await this.service.getPersonalDashboard(
        organizationId,
        userId,
      );

      return res.success(dashboard, "Dashboard personnel récupéré avec succès");
    } catch (error) {
      const statusCode = error.message.includes("Permissions") ? 403 : 400;
      return res.error(error.message, statusCode);
    }
  }

  /**
   * Route AUTO avec détection de l'espace
   * Route: GET /organizations/:organizationId/dashboard?space=personal|management
   */
  async getAutoDashboard(req, res) {
    try {
      const { organizationId } = req.params;
      const { space } = req.query; // 'personal' ou 'management'
      const userId = req.user.id;

      const dashboard = await this.service.getAutoDashboard(
        organizationId,
        userId,
        space,
      );

      return res.success(dashboard, "Dashboard récupéré avec succès");
    } catch (error) {
      const statusCode = error.message.includes("Permissions") ? 403 : 400;
      return res.error(error.message, statusCode);
    }
  }

  /**
   * Route par défaut (pour la redirection initiale)
   * Route: GET /organizations/:organizationId/dashboard
   */
  async getDefaultDashboard(req, res) {
    try {
      const { organizationId } = req.params;
      const userId = req.user.id;

      const result = await this.service.getDefaultDashboard(
        organizationId,
        userId,
      );

      return res.success(result, "Dashboard récupéré avec succès");
    } catch (error) {
      const statusCode = error.message.includes("Permissions") ? 403 : 400;
      return res.error(error.message, statusCode);
    }
  }
}
