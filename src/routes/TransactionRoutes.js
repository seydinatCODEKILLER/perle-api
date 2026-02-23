import express from "express";
import TransactionController from "../controllers/TransactionController.js";
import AuthMiddleware from "../middlewares/AuthMiddleware.js";

export default class TransactionRoutes {
  constructor() {
    this.router = express.Router({ mergeParams: true });
    this.controller = new TransactionController();
    this.authMiddleware = new AuthMiddleware();

    this.setupRoutes();
  }

  setupRoutes() {
    // Routes protégées
    this.router.use(this.authMiddleware.protect());

    /**
     * @swagger
     * /api/transactions/{organizationId}:
     *   get:
     *     summary: Lister toutes les transactions avec filtres
     *     tags: [Transactions]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: organizationId
     *         required: true
     *         schema:
     *           type: string
     *       - in: query
     *         name: type
     *         schema:
     *           type: string
     *           enum: [CONTRIBUTION, DEBT_REPAYMENT, FINE, DONATION, EXPENSE, OTHER]
     *       - in: query
     *         name: paymentMethod
     *         schema:
     *           type: string
     *           enum: [CASH, MOBILE_MONEY, BANK_TRANSFER, CHECK, CREDIT_CARD]
     *       - in: query
     *         name: paymentStatus
     *         schema:
     *           type: string
     *           enum: [PENDING, COMPLETED, FAILED, REFUNDED]
     *       - in: query
     *         name: membershipId
     *         schema:
     *           type: string
     *       - in: query
     *         name: startDate
     *         schema:
     *           type: string
     *           format: date
     *       - in: query
     *         name: endDate
     *         schema:
     *           type: string
     *           format: date
     *       - in: query
     *         name: search
     *         schema:
     *           type: string
     *       - in: query
     *         name: page
     *         schema:
     *           type: integer
     *           default: 1
     *       - in: query
     *         name: limit
     *         schema:
     *           type: integer
     *           default: 10
     *     responses:
     *       200:
     *         description: Liste des transactions
     */
    this.router.get("/:organizationId", (req, res) =>
      this.controller.getTransactions(req, res),
    );

    /**
     * @swagger
     * /api/transactions/{organizationId}/search:
     *   get:
     *     summary: Rechercher des transactions par référence ou membre
     *     tags: [Transactions]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: organizationId
     *         required: true
     *         schema:
     *           type: string
     *       - in: query
     *         name: q
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Résultats de la recherche
     */
    this.router.get("/:organizationId/search", (req, res) =>
      this.controller.searchTransactions(req, res),
    );

    /**
     * @swagger
     * /api/transactions/{organizationId}/members:
     *   get:
     *     summary: Voir les transactions d'un membre spécifique
     *     tags: [Transactions]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: organizationId
     *         required: true
     *         schema:
     *           type: string
     *       - in: path
     *         name: membershipId
     *         required: true
     *         schema:
     *           type: string
     *       - in: query
     *         name: type
     *         schema:
     *           type: string
     *           enum: [CONTRIBUTION, DEBT_REPAYMENT, FINE, DONATION, EXPENSE, OTHER]
     *       - in: query
     *         name: paymentMethod
     *         schema:
     *           type: string
     *           enum: [CASH, MOBILE_MONEY, BANK_TRANSFER, CHECK, CREDIT_CARD]
     *       - in: query
     *         name: paymentStatus
     *         schema:
     *           type: string
     *           enum: [PENDING, COMPLETED, FAILED, REFUNDED]
     *       - in: query
     *         name: startDate
     *         schema:
     *           type: string
     *           format: date
     *       - in: query
     *         name: endDate
     *         schema:
     *           type: string
     *           format: date
     *       - in: query
     *         name: page
     *         schema:
     *           type: integer
     *           default: 1
     *       - in: query
     *         name: limit
     *         schema:
     *           type: integer
     *           default: 10
     *     responses:
     *       200:
     *         description: Transactions du membre
     */
    this.router.get("/:organizationId/members/transactions", (req, res) =>
      this.controller.getMyTransactions(req, res),
    );

    /**
     * @swagger
     * /api/transactions/{organizationId}/transaction/{id}:
     *   get:
     *     summary: Voir une transaction spécifique
     *     tags: [Transactions]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: organizationId
     *         required: true
     *         schema:
     *           type: string
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Détails de la transaction
     */
    this.router.get("/:organizationId/transaction/:id", (req, res) =>
      this.controller.getTransaction(req, res),
    );

    /**
     * @swagger
     * /api/transactions/{organizationId}/members/{membershipId}:
     *   get:
     *     summary: Voir les transactions d'un membre spécifique
     *     tags: [Transactions]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: organizationId
     *         required: true
     *         schema:
     *           type: string
     *       - in: path
     *         name: membershipId
     *         required: true
     *         schema:
     *           type: string
     *       - in: query
     *         name: type
     *         schema:
     *           type: string
     *           enum: [CONTRIBUTION, DEBT_REPAYMENT, FINE, DONATION, EXPENSE, OTHER]
     *       - in: query
     *         name: paymentMethod
     *         schema:
     *           type: string
     *           enum: [CASH, MOBILE_MONEY, BANK_TRANSFER, CHECK, CREDIT_CARD]
     *       - in: query
     *         name: paymentStatus
     *         schema:
     *           type: string
     *           enum: [PENDING, COMPLETED, FAILED, REFUNDED]
     *       - in: query
     *         name: startDate
     *         schema:
     *           type: string
     *           format: date
     *       - in: query
     *         name: endDate
     *         schema:
     *           type: string
     *           format: date
     *       - in: query
     *         name: page
     *         schema:
     *           type: integer
     *           default: 1
     *       - in: query
     *         name: limit
     *         schema:
     *           type: integer
     *           default: 10
     *     responses:
     *       200:
     *         description: Transactions du membre
     */
    this.router.get("/:organizationId/members/:membershipId", (req, res) =>
      this.controller.getMemberTransactions(req, res),
    );

    /**
     * @swagger
     * ✅ NOUVELLE ROUTE : Vérifier la cohérence du wallet
     * /api/transactions/{organizationId}/verify-integrity:
     *   get:
     *     summary: Vérifier la cohérence entre le wallet et les transactions
     *     tags: [Transactions]
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
     *         description: Résultat de la vérification de cohérence
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 wallet:
     *                   type: object
     *                   properties:
     *                     currentBalance:
     *                       type: number
     *                     totalIncome:
     *                       type: number
     *                     totalExpenses:
     *                       type: number
     *                 calculated:
     *                   type: object
     *                   properties:
     *                     income:
     *                       type: number
     *                     expenses:
     *                       type: number
     *                     balance:
     *                       type: number
     *                 isConsistent:
     *                   type: boolean
     *                 discrepancy:
     *                   type: number
     *       403:
     *         description: Accès réservé aux administrateurs
     *       404:
     *         description: Wallet non trouvé
     */
    this.router.get("/:organizationId/verify-integrity", (req, res) =>
      this.controller.verifyWalletIntegrity(req, res),
    );

    /**
     * @swagger
     * 📊 NOUVELLE ROUTE : Statistiques par type de transaction
     * /api/transactions/{organizationId}/stats-by-type:
     *   get:
     *     summary: Obtenir les statistiques groupées par type de transaction
     *     tags: [Transactions]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: organizationId
     *         required: true
     *         schema:
     *           type: string
     *       - in: query
     *         name: startDate
     *         schema:
     *           type: string
     *           format: date
     *           description: Date de début pour le filtrage
     *       - in: query
     *         name: endDate
     *         schema:
     *           type: string
     *           format: date
     *           description: Date de fin pour le filtrage
     *     responses:
     *       200:
     *         description: Statistiques par type
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 wallet:
     *                   type: object
     *                   properties:
     *                     currentBalance:
     *                       type: number
     *                     totalIncome:
     *                       type: number
     *                     totalExpenses:
     *                       type: number
     *                 byType:
     *                   type: array
     *                   items:
     *                     type: object
     *                     properties:
     *                       type:
     *                         type: string
     *                       totalAmount:
     *                         type: number
     *                       count:
     *                         type: integer
     *                 summary:
     *                   type: object
     *                   properties:
     *                     totalTransactions:
     *                       type: integer
     *                     totalAmount:
     *                       type: number
     */
    this.router.get("/:organizationId/stats-by-type", (req, res) =>
      this.controller.getTransactionStatsByType(req, res),
    );
  }

  get routes() {
    return this.router;
  }
}
