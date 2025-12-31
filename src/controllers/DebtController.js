import DebtService from "../services/DebtService.js";
import DebtSchema from "../schemas/DebtSchema.js";

export default class DebtController {
  constructor() {
    this.service = new DebtService();
    this.schema = new DebtSchema();
  }

  async createDebt(req, res) {
    try {
      // Validation des données
      this.schema.validateCreate(req.body);

      const { organizationId } = req.params;
      const userId = req.user.id;

      const debt = await this.service.createDebt(
        organizationId,
        userId,
        req.body
      );

      return res.success(debt, "Dette créée avec succès", 201);
    } catch (error) {
      return res.error(error.message, 400);
    }
  }

  async getDebt(req, res) {
    try {
      const { organizationId, id } = req.params;
      const userId = req.user.id;

      const debt = await this.service.getDebtById(
        organizationId,
        id,
        userId
      );

      return res.success(debt, "Dette récupérée avec succès");
    } catch (error) {
      const statusCode = error.message.includes("non autorisé") ? 403 : 404;
      return res.error(error.message, statusCode);
    }
  }

  async getOrganizationDebts(req, res) {
    try {
      const { organizationId } = req.params;
      const userId = req.user.id;
      const { 
        status, 
        membershipId, 
        search,
        page, 
        limit 
      } = req.query;

      const result = await this.service.getOrganizationDebts(
        organizationId,
        userId,
        {
          status,
          membershipId,
          search,
          page: parseInt(page) || 1,
          limit: parseInt(limit) || 10,
        }
      );

      return res.success(result, "Dettes récupérées avec succès");
    } catch (error) {
      return res.error(error.message, 400);
    }
  }

  async getMemberDebts(req, res) {
    try {
      const { organizationId, membershipId } = req.params;
      const userId = req.user.id;
      const { status, page, limit } = req.query;

      const result = await this.service.getMemberDebts(
        organizationId,
        membershipId,
        userId,
        {
          status,
          page: parseInt(page) || 1,
          limit: parseInt(limit) || 10,
        }
      );

      return res.success(result, "Dettes du membre récupérées avec succès");
    } catch (error) {
      return res.error(error.message, 400);
    }
  }

  async addRepayment(req, res) {
    try {
      // Validation des données
      this.schema.validateRepayment(req.body);

      const { organizationId, id } = req.params;
      const userId = req.user.id;

      const debt = await this.service.addRepayment(
        organizationId,
        id,
        userId,
        req.body
      );

      return res.success(debt, "Remboursement ajouté avec succès");
    } catch (error) {
      return res.error(error.message, 400);
    }
  }

  async getDebtRepayments(req, res) {
    try {
      const { organizationId, id } = req.params;
      const userId = req.user.id;

      const repayments = await this.service.getDebtRepayments(
        organizationId,
        id,
        userId
      );

      return res.success(repayments, "Historique des remboursements récupéré avec succès");
    } catch (error) {
      const statusCode = error.message.includes("non autorisé") ? 403 : 404;
      return res.error(error.message, statusCode);
    }
  }

  async updateDebtStatus(req, res) {
    try {
      const { organizationId, id } = req.params;
      const userId = req.user.id;
      const { status } = req.body;

      if (!status) {
        return res.error("Le statut est requis", 400);
      }

      const debt = await this.service.updateDebtStatus(
        organizationId,
        id,
        userId,
        status
      );

      return res.success(debt, "Statut de la dette mis à jour avec succès");
    } catch (error) {
      return res.error(error.message, 400);
    }
  }

  async getDebtSummary(req, res) {
    try {
      const { organizationId } = req.params;
      const userId = req.user.id;

      const summary = await this.service.getDebtSummary(
        organizationId,
        userId
      );

      return res.success(summary, "Résumé des dettes récupéré avec succès");
    } catch (error) {
      return res.error(error.message, 400);
    }
  }
}