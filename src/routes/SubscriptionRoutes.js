import express from "express";
import SubscriptionController from "../controllers/SubscriptionController.js";
import AuthMiddleware from "../middlewares/AuthMiddleware.js";

export default class SubscriptionRoutes {
  constructor() {
    this.router = express.Router({ mergeParams: true });
    this.controller = new SubscriptionController();
    this.authMiddleware = new AuthMiddleware();

    this.setupRoutes();
  }

  setupRoutes() {
    // Routes protégées
    this.router.use(this.authMiddleware.protect());

    /**
     * @swagger
     * /api/subscriptions/organizations/{organizationId}:
     *   get:
     *     summary: Récupérer l'abonnement d'une organisation
     *     tags: [Subscriptions]
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
     *         description: Détails de l'abonnement
     */
    this.router.get("/organizations/:organizationId", (req, res) =>
      this.controller.getSubscription(req, res)
    );

    /**
     * @swagger
     * /api/subscriptions/organizations/{organizationId}/usage:
     *   get:
     *     summary: Voir l'utilisation de l'abonnement
     *     tags: [Subscriptions]
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
     *         description: Utilisation de l'abonnement
     */
    this.router.get("/organizations/:organizationId/usage", (req, res) =>
      this.controller.getUsage(req, res)
    );

    /**
     * @swagger
     * /api/subscriptions/organizations/{organizationId}/plans:
     *   get:
     *     summary: Récupérer les plans d'abonnement disponibles
     *     tags: [Subscriptions]
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
     *         description: Plans disponibles
     */
    this.router.get("/organizations/:organizationId/plans", (req, res) =>
      this.controller.getAvailablePlans(req, res)
    );

    /**
     * @swagger
     * /api/subscriptions/organizations/{organizationId}:
     *   put:
     *     summary: Mettre à jour l'abonnement
     *     tags: [Subscriptions]
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
     *             properties:
     *               plan:
     *                 type: string
     *                 enum: [FREE, BASIC, PREMIUM, ENTERPRISE]
     *               maxMembers:
     *                 type: integer
     *               price:
     *                 type: number
     *               currency:
     *                 type: string
     *               startDate:
     *                 type: string
     *                 format: date-time
     *               endDate:
     *                 type: string
     *                 format: date-time
     *     responses:
     *       200:
     *         description: Abonnement mis à jour
     */
    this.router.put("/organizations/:organizationId", (req, res) =>
      this.controller.updateSubscription(req, res)
    );

    /**
     * @swagger
     * /api/subscriptions/organizations/{organizationId}/status:
     *   patch:
     *     summary: Mettre à jour le statut de l'abonnement
     *     tags: [Subscriptions]
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
     *               - status
     *             properties:
     *               status:
     *                 type: string
     *                 enum: [ACTIVE, INACTIVE, SUSPENDED, CANCELLED, EXPIRED]
     *     responses:
     *       200:
     *         description: Statut mis à jour
     */
    this.router.patch("/organizations/:organizationId/status", (req, res) =>
      this.controller.updateSubscriptionStatus(req, res)
    );

    /**
     * @swagger
     * /api/subscriptions/organizations/{organizationId}/change-plan:
     *   post:
     *     summary: Changer de plan d'abonnement
     *     tags: [Subscriptions]
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
     *               - plan
     *             properties:
     *               plan:
     *                 type: string
     *                 enum: [FREE, BASIC, PREMIUM, ENTERPRISE]
     *     responses:
     *       200:
     *         description: Plan changé avec succès
     */
    this.router.post("/organizations/:organizationId/change-plan", (req, res) =>
      this.controller.changePlan(req, res)
    );
  }

  get routes() {
    return this.router;
  }
}