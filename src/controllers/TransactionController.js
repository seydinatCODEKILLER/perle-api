import TransactionService from "../services/TransactionService.js";

export default class TransactionController {
  constructor() {
    this.service = new TransactionService();
  }

  async getTransactions(req, res) {
    try {
      const { organizationId } = req.params;
      const userId = req.user.id;
      const { 
        type, 
        paymentMethod, 
        paymentStatus,
        membershipId,
        startDate, 
        endDate,
        search,
        page, 
        limit 
      } = req.query;

      const result = await this.service.getTransactions(
        organizationId,
        userId,
        {
          type,
          paymentMethod,
          paymentStatus,
          membershipId,
          startDate,
          endDate,
          search,
          page: parseInt(page) || 1,
          limit: parseInt(limit) || 10,
        }
      );

      return res.success(result, "Transactions récupérées avec succès");
    } catch (error) {
      return res.error(error.message, 400);
    }
  }

  async getTransaction(req, res) {
    try {
      const { organizationId, id } = req.params;
      const userId = req.user.id;

      const transaction = await this.service.getTransactionById(
        organizationId,
        id,
        userId
      );

      return res.success(transaction, "Transaction récupérée avec succès");
    } catch (error) {
      const statusCode = error.message.includes("non autorisé") ? 403 : 404;
      return res.error(error.message, statusCode);
    }
  }

  async searchTransactions(req, res) {
    try {
      const { organizationId } = req.params;
      const userId = req.user.id;
      const { q } = req.query;

      if (!q) {
        return res.error("Le terme de recherche est requis", 400);
      }

      const result = await this.service.searchTransactions(
        organizationId,
        userId,
        q
      );

      return res.success(result, "Recherche effectuée avec succès");
    } catch (error) {
      return res.error(error.message, 400);
    }
  }

  async getMemberTransactions(req, res) {
    try {
      const { organizationId, membershipId } = req.params;
      const userId = req.user.id;
      const { 
        type, 
        paymentMethod, 
        paymentStatus,
        startDate, 
        endDate,
        page, 
        limit 
      } = req.query;

      const result = await this.service.getMemberTransactions(
        organizationId,
        membershipId,
        userId,
        {
          type,
          paymentMethod,
          paymentStatus,
          startDate,
          endDate,
          page: parseInt(page) || 1,
          limit: parseInt(limit) || 10,
        }
      );

      return res.success(result, "Transactions du membre récupérées avec succès");
    } catch (error) {
      return res.error(error.message, 400);
    }
  }
}