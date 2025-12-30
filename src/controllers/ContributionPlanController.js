import ContributionPlanService from "../services/ContributionPlanService.js";
import ContributionPlanSchema from "../schemas/ContributionPlanSchema.js";

export default class ContributionPlanController {
  constructor() {
    this.service = new ContributionPlanService();
    this.schema = new ContributionPlanSchema();
  }

  async createContributionPlan(req, res) {
    try {
      // Validation des données
      this.schema.validateCreate(req.body);

      const { organizationId } = req.params;
      const userId = req.user.id;

      const plan = await this.service.createContributionPlan(
        organizationId,
        userId,
        req.body
      );

      return res.success(plan, "Plan de cotisation créé avec succès", 201);
    } catch (error) {
      return res.error(error.message, 400);
    }
  }

  async getContributionPlan(req, res) {
    try {
      const { organizationId, id } = req.params;
      const userId = req.user.id;

      const plan = await this.service.getContributionPlanById(
        organizationId,
        id,
        userId
      );

      return res.success(plan, "Plan de cotisation récupéré avec succès");
    } catch (error) {
      const statusCode = error.message.includes("non autorisé") ? 403 : 404;
      return res.error(error.message, statusCode);
    }
  }

  async getOrganizationContributionPlans(req, res) {
    try {
      const { organizationId } = req.params;
      const userId = req.user.id;
      const { isActive, search, page, limit } = req.query;

      const result = await this.service.getOrganizationContributionPlans(
        organizationId,
        userId,
        {
          isActive,
          search,
          page: parseInt(page) || 1,
          limit: parseInt(limit) || 10,
        }
      );

      return res.success(result, "Plans de cotisation récupérés avec succès");
    } catch (error) {
      return res.error(error.message, 400);
    }
  }

  async updateContributionPlan(req, res) {
    try {
      // Validation des données
      this.schema.validateUpdate(req.body);

      const { organizationId, id } = req.params;
      const userId = req.user.id;

      const plan = await this.service.updateContributionPlan(
        organizationId,
        id,
        userId,
        req.body
      );

      return res.success(plan, "Plan de cotisation mis à jour avec succès");
    } catch (error) {
      const statusCode = error.message.includes("Permissions") ? 403 : 400;
      return res.error(error.message, statusCode);
    }
  }

  async toggleContributionPlanStatus(req, res) {
    try {
      const { organizationId, id } = req.params;
      const userId = req.user.id;

      const plan = await this.service.toggleContributionPlanStatus(
        organizationId,
        id,
        userId
      );

      const action = plan.isActive ? "activé" : "désactivé";
      return res.success(plan, `Plan de cotisation ${action} avec succès`);
    } catch (error) {
      const statusCode = error.message.includes("Permissions") ? 403 : 400;
      return res.error(error.message, statusCode);
    }
  }

  async deleteContributionPlan(req, res) {
    try {
      const { organizationId, id } = req.params;
      const userId = req.user.id;

      const plan = await this.service.deleteContributionPlan(
        organizationId,
        id,
        userId
      );

      return res.success(plan, "Plan de cotisation supprimé avec succès");
    } catch (error) {
      const statusCode = error.message.includes("Permissions") ? 403 : 400;
      return res.error(error.message, statusCode);
    }
  }

  async generateContributions(req, res) {
    try {
      const { organizationId, id } = req.params;
      const userId = req.user.id;
      const { force, dueDateOffset } = req.body;

      const result = await this.service.generateContributionsForPlan(
        organizationId,
        id,
        userId,
        {
          force: force || false,
          dueDateOffset: dueDateOffset || 0,
        }
      );

      return res.success(result, "Cotisations générées avec succès");
    } catch (error) {
      return res.error(error.message, 400);
    }
  }

  async assignPlanToMember(req, res) {
    try {
      this.schema.validateAssignToMember(req.body);
      const { organizationId, id } = req.params;
      const userId = req.user.id;
      const { membershipId } = req.body;

      const contribution = await this.service.assignPlanToMember(
        organizationId,
        id,
        membershipId,
        userId
      );

      return res.success(
        contribution,
        "Plan assigné au membre avec succès",
        201
      );
    } catch (error) {
      return res.error(error.message, 400);
    }
  }
}
