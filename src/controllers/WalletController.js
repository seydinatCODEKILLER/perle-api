import WalletService from "../services/WalletService.js";

export default class WalletController {
  constructor() {
    this.service = new WalletService();
  }

  async getOrCreateWallet(req, res) {
    try {
      const { organizationId } = req.params;
      const userId = req.user.id;

      const wallet = await this.service.getOrCreateWallet(
        organizationId,
        userId
      );

      return res.success(wallet, "Portefeuille récupéré avec succès");
    } catch (error) {
      const statusCode = error.message.includes("non autorisé") ? 403 
        : error.message.includes("Seul un administrateur") ? 403 
        : 400;
      return res.error(error.message, statusCode);
    }
  }

  async getWalletById(req, res) {
    try {
      const { organizationId, walletId } = req.params;
      const userId = req.user.id;

      const wallet = await this.service.getWalletById(
        walletId,
        organizationId,
        userId
      );

      return res.success(wallet, "Portefeuille récupéré avec succès");
    } catch (error) {
      const statusCode = error.message.includes("non autorisé") ? 403 
        : error.message.includes("non trouvé") ? 404 
        : 400;
      return res.error(error.message, statusCode);
    }
  }

  async getWalletStats(req, res) {
    try {
      const { organizationId } = req.params;
      const userId = req.user.id;

      const stats = await this.service.getWalletStats(
        organizationId,
        userId
      );

      return res.success(stats, "Statistiques du portefeuille récupérées avec succès");
    } catch (error) {
      const statusCode = error.message.includes("non autorisé") ? 403 : 400;
      return res.error(error.message, statusCode);
    }
  }

  async reconcileWallet(req, res) {
    try {
      const { organizationId } = req.params;
      const userId = req.user.id;
      const { expectedBalance, note } = req.body;

      const result = await this.service.reconcileWallet(
        organizationId,
        userId,
        expectedBalance,
        note
      );

      return res.success(result, "Portefeuille réconcilié avec succès");
    } catch (error) {
      const statusCode = error.message.includes("non autorisé") ? 403 
        : error.message.includes("Permissions financières") ? 403 
        : 400;
      return res.error(error.message, statusCode);
    }
  }
}