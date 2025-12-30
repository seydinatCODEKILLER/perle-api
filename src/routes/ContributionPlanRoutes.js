import express from "express";
import ContributionPlanController from "../controllers/ContributionPlanController.js";
import AuthMiddleware from "../middlewares/AuthMiddleware.js";

export default class ContributionPlanRoutes {
  constructor() {
    this.router = express.Router({ mergeParams: true });
    this.controller = new ContributionPlanController();
    this.authMiddleware = new AuthMiddleware();

    this.setupRoutes();
  }

  setupRoutes() {
    this.router.use(this.authMiddleware.protect());

    /**
     * @swagger
     * /api/contribution-plans/{organizationId}:
     *   post:
     *     summary: Créer un nouveau plan de cotisation
     *     tags: [Contribution Plans]
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
     *               - name
     *               - amount
     *               - frequency
     *               - startDate
     *             properties:
     *               name:
     *                 type: string
     *               description:
     *                 type: string
     *               amount:
     *                 type: number
     *               frequency:
     *                 type: string
     *                 enum: [WEEKLY, MONTHLY, QUARTERLY, YEARLY, CUSTOM]
     *               currency:
     *                 type: string
     *                 default: XOF
     *               startDate:
     *                 type: string
     *                 format: date-time
     *               endDate:
     *                 type: string
     *                 format: date-time
     *               isActive:
     *                 type: boolean
     *                 default: true
     *     responses:
     *       201:
     *         description: Plan créé avec succès
     */
    this.router.post("/:organizationId", (req, res) =>
      this.controller.createContributionPlan(req, res)
    );

    /**
     * @swagger
     * /api/contribution-plans/{organizationId}:
     *   get:
     *     summary: Récupérer tous les plans de cotisation d'une organisation
     *     tags: [Contribution Plans]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: organizationId
     *         required: true
     *         schema:
     *           type: string
     *       - in: query
     *         name: isActive
     *         schema:
     *           type: boolean
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
     *         description: Liste des plans
     */
    this.router.get("/:organizationId", (req, res) =>
      this.controller.getOrganizationContributionPlans(req, res)
    );

    /**
     * @swagger
     * /api/contribution-plans/{organizationId}/plans/{id}:
     *   get:
     *     summary: Récupérer un plan de cotisation spécifique
     *     tags: [Contribution Plans]
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
     *         description: Détails du plan
     */
    this.router.get("/:organizationId/plans/:id", (req, res) =>
      this.controller.getContributionPlan(req, res)
    );

    /**
     * @swagger
     * /api/contribution-plans/{organizationId}/plans/{id}:
     *   put:
     *     summary: Mettre à jour un plan de cotisation
     *     tags: [Contribution Plans]
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
     *             properties:
     *               name:
     *                 type: string
     *               description:
     *                 type: string
     *               amount:
     *                 type: number
     *               frequency:
     *                 type: string
     *                 enum: [WEEKLY, MONTHLY, QUARTERLY, YEARLY, CUSTOM]
     *               currency:
     *                 type: string
     *               startDate:
     *                 type: string
     *                 format: date-time
     *               endDate:
     *                 type: string
     *                 format: date-time
     *               isActive:
     *                 type: boolean
     *     responses:
     *       200:
     *         description: Plan mis à jour
     */
    this.router.put("/:organizationId/plans/:id", (req, res) =>
      this.controller.updateContributionPlan(req, res)
    );

    /**
     * @swagger
     * /api/contribution-plans/{organizationId}/plans/{id}/toggle-status:
     *   patch:
     *     summary: Activer/désactiver un plan de cotisation
     *     tags: [Contribution Plans]
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
     *         description: Statut modifié
     */
    this.router.patch("/:organizationId/plans/:id/toggle-status", (req, res) =>
      this.controller.toggleContributionPlanStatus(req, res)
    );

    /**
     * @swagger
     * /api/contribution-plans/{organizationId}/plans/{id}:
     *   delete:
     *     summary: Supprimer un plan de cotisation
     *     tags: [Contribution Plans]
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
     *         description: Plan supprimé
     */
    this.router.delete("/:organizationId/plans/:id", (req, res) =>
      this.controller.deleteContributionPlan(req, res)
    );

    /**
     * @swagger
     * /api/contribution-plans/{organizationId}/plans/{id}/generate-contributions:
     *   post:
     *     summary: Générer des cotisations pour tous les membres
     *     tags: [Contribution Plans]
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
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               force:
     *                 type: boolean
     *                 description: Forcer la génération même si des cotisations existent déjà
     *               dueDateOffset:
     *                 type: integer
     *                 description: Décalage en jours pour la date d'échéance
     *     responses:
     *       200:
     *         description: Cotisations générées
     */
    this.router.post("/:organizationId/plans/:id/generate-contributions", (req, res) =>
      this.controller.generateContributions(req, res)
    );

    /**
     * @swagger
     * /api/contribution-plans/{organizationId}/plans/{id}/assign-to-member:
     *   post:
     *     summary: Assigner un plan à un membre spécifique
     *     tags: [Contribution Plans]
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
     *               - membershipId
     *             properties:
     *               membershipId:
     *                 type: string
     *     responses:
     *       201:
     *         description: Plan assigné au membre
     */
    this.router.post("/:organizationId/plans/:id/assign-to-member", (req, res) =>
      this.controller.assignPlanToMember(req, res)
    );
  }

  get routes() {
    return this.router;
  }
}