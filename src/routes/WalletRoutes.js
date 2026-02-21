import express from "express";
import AuthMiddleware from "../middlewares/AuthMiddleware.js";
import WalletController from "../controllers/WalletController.js";

export default class WalletRoutes {
  constructor() {
    this.router = express.Router({ mergeParams: true });
    this.controller = new WalletController();
    this.authMiddleware = new AuthMiddleware();

    this.setupRoutes();
  }

  setupRoutes() {
    this.router.use(this.authMiddleware.protect());

    /**
     * @swagger
     * /api/wallet/{organizationId}/{walletId}:
     *   get:
     *     summary: Récupérer un portefeuille par son ID
     *     tags: [Wallet]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: organizationId
     *         required: true
     *         schema:
     *           type: string
     *       - in: path
     *         name: walletId
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Portefeuille récupéré avec succès
     *       404:
     *         description: Portefeuille non trouvé
     */
    this.router.get("/:organizationId/:walletId", (req, res) =>
      this.controller.getWalletById(req, res),
    );

    /**
     * @swagger
     * /api/wallet/{organizationId}:
     *   get:
     *     summary: Récupérer ou créer le portefeuille de l'organisation
     *     tags: [Wallet]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: organizationId
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Portefeuille récupéré avec succès
     *       403:
     *         description: Accès non autorisé
     */
    this.router.get("/:organizationId", (req, res) =>
      this.controller.getOrCreateWallet(req, res),
    );

    /**
     * @swagger
     * /api/wallet/{organizationId}/stats:
     *   get:
     *     summary: Récupérer les statistiques du portefeuille
     *     tags: [Wallet]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: organizationId
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Statistiques du portefeuille
     */
    this.router.get("/:organizationId/stats", (req, res) =>
      this.controller.getWalletStats(req, res),
    );

    /**
     * @swagger
     * /api/wallet/{organizationId}/reconcile:
     *   post:
     *     summary: Réconcilier le portefeuille avec un solde attendu
     *     tags: [Wallet]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: organizationId
     *         required: true
     *         schema:
     *           type: string
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - expectedBalance
     *             properties:
     *               expectedBalance:
     *                 type: number
     *                 description: Solde attendu après réconciliation
     *               note:
     *                 type: string
     *                 description: Note explicative
     *     responses:
     *       200:
     *         description: Portefeuille réconcilié avec succès
     *       403:
     *         description: Permissions financières insuffisantes
     */
    this.router.post("/:organizationId/reconcile", (req, res) =>
      this.controller.reconcileWallet(req, res),
    );
  }

  get routes() {
    return this.router;
  }
}
