import express from "express";
import ContributionController from "../controllers/ContributionController.js";
import AuthMiddleware from "../middlewares/AuthMiddleware.js";

export default class ContributionRoutes {
  constructor() {
    this.router = express.Router({ mergeParams: true });
    this.controller = new ContributionController();
    this.authMiddleware = new AuthMiddleware();

    this.setupRoutes();
  }

  setupRoutes() {
    // Routes protégées
    this.router.use(this.authMiddleware.protect());

    /**
     * @swagger
     * /api/contributions/{organizationId}:
     *   get:
     *     summary: Récupérer toutes les cotisations d'une organisation
     *     tags: [Contributions]
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
     *           enum: [PENDING, PAID, PARTIAL, OVERDUE, CANCELLED]
     *       - in: query
     *         name: membershipId
     *         schema:
     *           type: string
     *       - in: query
     *         name: contributionPlanId
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
     *         description: Liste des cotisations
     */
    this.router.get("/:organizationId", (req, res) =>
      this.controller.getContributions(req, res)
    );

    /**
     * @swagger
     * /api/contributions/{organizationId}/contribution/{id}:
     *   get:
     *     summary: Récupérer une cotisation spécifique
     *     tags: [Contributions]
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
     *         description: Détails de la cotisation
     */
    this.router.get("/:organizationId/contribution/:id", (req, res) =>
      this.controller.getContribution(req, res)
    );

    /**
     * @swagger
     * /api/contributions/{organizationId}/contribution/{id}/mark-paid:
     *   patch:
     *     summary: Marquer une cotisation comme payée
     *     tags: [Contributions]
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
     *               - amountPaid
     *               - paymentMethod
     *             properties:
     *               amountPaid:
     *                 type: number
     *               paymentMethod:
     *                 type: string
     *                 enum: [CASH, MOBILE_MONEY, BANK_TRANSFER, CHECK, CREDIT_CARD]
     *     responses:
     *       200:
     *         description: Cotisation marquée comme payée
     */
    this.router.patch("/:organizationId/contribution/:id/mark-paid", (req, res) =>
      this.controller.markAsPaid(req, res)
    );

    /**
     * @swagger
     * /api/contributions/{organizationId}/contribution/{id}/partial-payment:
     *   post:
     *     summary: Ajouter un paiement partiel
     *     tags: [Contributions]
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
     *         description: Paiement partiel ajouté
     */
    this.router.post("/:organizationId/contribution/:id/partial-payment", (req, res) =>
      this.controller.addPartialPayment(req, res)
    );

    /**
     * @swagger
     * /api/contributions/{organizationId}/members/{membershipId}/contributions:
     *   get:
     *     summary: Récupérer les cotisations d'un membre spécifique
     *     tags: [Contributions]
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
     *           enum: [PENDING, PAID, PARTIAL, OVERDUE, CANCELLED]
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
     *         description: Cotisations du membre
     */
    this.router.get("/:organizationId/members/:membershipId/contributions", (req, res) =>
      this.controller.getMemberContributions(req, res)
    );
  }

  get routes() {
    return this.router;
  }
}