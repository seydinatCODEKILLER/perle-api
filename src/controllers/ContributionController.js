import ContributionService from "../services/ContributionService.js";
import ContributionSchema from "../schemas/ContributionSchema.js";

export default class ContributionController {
  constructor() {
    this.service = new ContributionService();
    this.schema = new ContributionSchema();
  }

  async getContributions(req, res) {
    try {
      const { organizationId } = req.params;
      const userId = req.user.id;
      const { 
        status, 
        membershipId, 
        contributionPlanId, 
        startDate, 
        endDate,
        page, 
        limit 
      } = req.query;

      const result = await this.service.getContributions(
        organizationId,
        userId,
        {
          status,
          membershipId,
          contributionPlanId,
          startDate,
          endDate,
          page: parseInt(page) || 1,
          limit: parseInt(limit) || 10,
        }
      );

      return res.success(result, "Cotisations récupérées avec succès");
    } catch (error) {
      return res.error(error.message, 400);
    }
  }

  async getContribution(req, res) {
    try {
      const { organizationId, id } = req.params;
      const userId = req.user.id;

      const contribution = await this.service.getContributionById(
        organizationId,
        id,
        userId
      );

      return res.success(contribution, "Cotisation récupérée avec succès");
    } catch (error) {
      const statusCode = error.message.includes("non autorisé") ? 403 : 404;
      return res.error(error.message, statusCode);
    }
  }

  async markAsPaid(req, res) {
    try {
      // Validation des données
      this.schema.validatePayment(req.body);

      const { organizationId, id } = req.params;
      const userId = req.user.id;

      const contribution = await this.service.markAsPaid(
        organizationId,
        id,
        userId,
        req.body
      );

      return res.success(contribution, "Cotisation marquée comme payée avec succès");
    } catch (error) {
      return res.error(error.message, 400);
    }
  }

  async addPartialPayment(req, res) {
    try {
      // Validation des données
      this.schema.validatePartialPayment(req.body);

      const { organizationId, id } = req.params;
      const userId = req.user.id;

      const contribution = await this.service.addPartialPayment(
        organizationId,
        id,
        userId,
        req.body
      );

      return res.success(contribution, "Paiement partiel ajouté avec succès");
    } catch (error) {
      return res.error(error.message, 400);
    }
  }
  
  async getMemberContributions(req, res) {
    try {
      const { organizationId, membershipId } = req.params;
      const userId = req.user.id;
      const { status, page, limit } = req.query;

      const result = await this.service.getMemberContributions(
        organizationId,
        membershipId,
        userId,
        {
          status,
          page: parseInt(page) || 1,
          limit: parseInt(limit) || 10,
        }
      );

      return res.success(result, "Cotisations du membre récupérées avec succès");
    } catch (error) {
      return res.error(error.message, 400);
    }
  }
}