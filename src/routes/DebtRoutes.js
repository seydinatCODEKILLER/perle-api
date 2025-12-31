import express from "express";
import DebtController from "../controllers/DebtController.js";
import AuthMiddleware from "../middlewares/AuthMiddleware.js";

export default class DebtRoutes {
  constructor() {
    this.router = express.Router({ mergeParams: true });
    this.controller = new DebtController();
    this.authMiddleware = new AuthMiddleware();

    this.setupRoutes();
  }

  setupRoutes() {
    // Routes protégées
    this.router.use(this.authMiddleware.protect());

    /**
     * @swagger
     * /api/debts/{organizationId}:
     *   post:
     *     summary: Créer une nouvelle dette pour un membre
     *     tags: [Debts]
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
     *               - membershipId
     *               - title
     *               - initialAmount
     *             properties:
     *               membershipId:
     *                 type: string
     *               title:
     *                 type: string
     *               description:
     *                 type: string
     *               initialAmount:
     *                 type: number
     *               dueDate:
     *                 type: string
     *                 format: date-time
     *               status:
     *                 type: string
     *                 enum: [ACTIVE, PARTIALLY_PAID, PAID, OVERDUE, CANCELLED]
     *                 default: ACTIVE
     *     responses:
     *       201:
     *         description: Dette créée avec succès
     */
    this.router.post("/:organizationId", (req, res) =>
      this.controller.createDebt(req, res)
    );

    /**
     * @swagger
     * /api/debts/{organizationId}:
     *   get:
     *     summary: Récupérer toutes les dettes d'une organisation
     *     tags: [Debts]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: organizationId
     *         required: true
     *         schema:
     *           type: string
     *       - in: query
     *         name: status
     *         schema:
     *           type: string
     *           enum: [ACTIVE, PARTIALLY_PAID, PAID, OVERDUE, CANCELLED]
     *       - in: query
     *         name: membershipId
     *         schema:
     *           type: string
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
     *         description: Liste des dettes
     */
    this.router.get("/:organizationId", (req, res) =>
      this.controller.getOrganizationDebts(req, res)
    );

    /**
     * @swagger
     * /api/debts/{organizationId}/summary:
     *   get:
     *     summary: Récupérer le résumé des dettes
     *     tags: [Debts]
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
     *         description: Résumé des dettes
     */
    this.router.get("/:organizationId/summary", (req, res) =>
      this.controller.getDebtSummary(req, res)
    );

    /**
     * @swagger
     * /api/debts/{organizationId}/debt/{id}:
     *   get:
     *     summary: Récupérer une dette spécifique
     *     tags: [Debts]
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
     *         description: Détails de la dette
     */
    this.router.get("/:organizationId/debt/:id", (req, res) =>
      this.controller.getDebt(req, res)
    );

    /**
     * @swagger
     * /api/debts/{organizationId}/debt/{id}/repayments:
     *   get:
     *     summary: Récupérer l'historique des remboursements d'une dette
     *     tags: [Debts]
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
     *         description: Historique des remboursements
     */
    this.router.get("/:organizationId/debt/:id/repayments", (req, res) =>
      this.controller.getDebtRepayments(req, res)
    );

    /**
     * @swagger
     * /api/debts/{organizationId}/debt/{id}/add-repayment:
     *   post:
     *     summary: Ajouter un remboursement à une dette
     *     tags: [Debts]
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
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - amount
     *               - paymentMethod
     *             properties:
     *               amount:
     *                 type: number
     *               paymentMethod:
     *                 type: string
     *                 enum: [CASH, MOBILE_MONEY, BANK_TRANSFER, CHECK, CREDIT_CARD]
     *     responses:
     *       200:
     *         description: Remboursement ajouté
     */
    this.router.post("/:organizationId/debt/:id/add-repayment", (req, res) =>
      this.controller.addRepayment(req, res)
    );

    /**
     * @swagger
     * /api/debts/{organizationId}/debt/{id}/status:
     *   patch:
     *     summary: Mettre à jour le statut d'une dette
     *     tags: [Debts]
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
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - status
     *             properties:
     *               status:
     *                 type: string
     *                 enum: [ACTIVE, PARTIALLY_PAID, PAID, OVERDUE, CANCELLED]
     *     responses:
     *       200:
     *         description: Statut mis à jour
     */
    this.router.patch("/:organizationId/debt/:id/status", (req, res) =>
      this.controller.updateDebtStatus(req, res)
    );

    /**
     * @swagger
     * /api/debts/{organizationId}/members/{membershipId}/debt:
     *   get:
     *     summary: Récupérer les dettes d'un membre spécifique
     *     tags: [Debts]
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
     *         name: status
     *         schema:
     *           type: string
     *           enum: [ACTIVE, PARTIALLY_PAID, PAID, OVERDUE, CANCELLED]
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
     *         description: Dettes du membre
     */
    this.router.get("/:organizationId/members/:membershipId/debt", (req, res) =>
      this.controller.getMemberDebts(req, res)
    );
  }

  get routes() {
    return this.router;
  }
}