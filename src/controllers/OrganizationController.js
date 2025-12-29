import OrganizationService from "../services/OrganizationService.js";
import OrganizationSchema from "../schemas/OrganizationSchema.js";

export default class OrganizationController {
  constructor() {
    this.service = new OrganizationService();
    this.schema = new OrganizationSchema();
  }

  async createOrganization(req, res) {
    try {
      // Validation des données
      this.schema.validateCreate(req.body);

      const ownerId = req.user.id;
      const logoFile = req.file;

      const organization = await this.service.createOrganization(
        ownerId,
        req.body,
        logoFile
      );

      return res.success(organization, "Organisation créée avec succès", 201);
    } catch (error) {
      return res.error(error.message, 400);
    }
  }

  async getOrganization(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const organization = await this.service.getOrganizationById(id, userId);

      return res.success(organization, "Organisation récupérée avec succès");
    } catch (error) {
      const statusCode = error.message.includes("non autorisé") ? 403 : 404;
      return res.error(error.message, statusCode);
    }
  }

  async getUserOrganizations(req, res) {
    try {
      const userId = req.user.id;

      const organizations = await this.service.getUserOrganizations(userId);

      return res.success(organizations, "Organisations récupérées avec succès");
    } catch (error) {
      return res.error(error.message, 400);
    }
  }

  async updateOrganization(req, res) {
    try {
      // Validation des données
      this.schema.validateUpdate(req.body);

      const { id } = req.params;
      const userId = req.user.id;
      const logoFile = req.file;

      const organization = await this.service.updateOrganization(
        id,
        userId,
        req.body,
        logoFile
      );

      return res.success(organization, "Organisation mise à jour avec succès");
    } catch (error) {
      const statusCode = error.message.includes("Permissions") ? 403 : 400;
      return res.error(error.message, statusCode);
    }
  }

  async updateOrganizationSettings(req, res) {
    try {
      // Validation des données
      this.schema.validateSettings(req.body);

      const { id } = req.params;
      const userId = req.user.id;

      const settings = await this.service.updateOrganizationSettings(
        id,
        userId,
        req.body
      );

      return res.success(settings, "Paramètres mis à jour avec succès");
    } catch (error) {
      const statusCode = error.message.includes("Permissions") ? 403 : 400;
      return res.error(error.message, statusCode);
    }
  }

  async deactivateOrganization(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const organization = await this.service.deactivateOrganization(
        id,
        userId
      );

      return res.success(organization, "Organisation désactivée avec succès");
    } catch (error) {
      const statusCode = error.message.includes("propriétaire") ? 403 : 400;
      return res.error(error.message, statusCode);
    }
  }

  async getOrganizationStats(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const stats = await this.service.getOrganizationStats(id, userId);

      return res.success(stats, "Statistiques récupérées avec succès");
    } catch (error) {
      const statusCode = error.message.includes("non autorisé") ? 403 : 404;
      return res.error(error.message, statusCode);
    }
  }

  async searchOrganizations(req, res) {
    try {
      const userId = req.user.id;
      const { search, type, page, limit } = req.query;

      const result = await this.service.searchOrganizations(
        userId,
        search,
        type,
        parseInt(page) || 1,
        parseInt(limit) || 10
      );

      return res.success(result, "Recherche effectuée avec succès");
    } catch (error) {
      return res.error(error.message, 400);
    }
  }
}
