import express from "express";
import DashboardController from "../controllers/DashboardController.js";
import AuthMiddleware from "../middlewares/AuthMiddleware.js";

export default class DashboardRoutes {
  constructor() {
    this.router = express.Router({ mergeParams: true });
    this.controller = new DashboardController();
    this.authMiddleware = new AuthMiddleware();

    this.setupRoutes();
  }

  setupRoutes() {
    // Routes protégées
    this.router.use(this.authMiddleware.protect());

    /**
     * @swagger
     * /api/statistiques/{organizationId}/admin:
     *   get:
     *     summary: Récupérer le dashboard ADMIN
     *     description: |
     *       Retourne les statistiques et KPIs pour les administrateurs :
     *       - 👥 Membres actifs
     *       - 💰 Total collecté
     *       - ⏳ Cotisations en attente
     *       - ⚠️ Dettes actives
     *       - 📅 Cotisations en retard
     *       - 💵 Résumé financier
     *       - 📊 Graphiques
     *     tags: [Dashboard]
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
     *         description: Dashboard ADMIN récupéré
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 data:
     *                   type: object
     *                   properties:
     *                     role:
     *                       type: string
     *                       example: "ADMIN"
     *                     organizationId:
     *                       type: string
     *                     kpis:
     *                       type: object
     *                       properties:
     *                         activeMembers:
     *                           type: object
     *                           properties:
     *                             value:
     *                               type: integer
     *                             label:
     *                               type: string
     *                             icon:
     *                               type: string
     *                         totalCollected:
     *                           type: object
     *                         pendingContributions:
     *                           type: object
     *                         activeDebts:
     *                           type: object
     *                         overdueContributions:
     *                           type: object
     *                     financialOverview:
     *                       type: object
     *                     charts:
     *                       type: object
     *                     subscription:
     *                       type: object
     *                     recentActivities:
     *                       type: array
     */
    this.router.get("/:organizationId/admin", (req, res) =>
      this.controller.getAdminDashboard(req, res)
    );

    /**
     * @swagger
     * /api/statistiques/{organizationId}/financial-manager:
     *   get:
     *     summary: Récupérer le dashboard FINANCIAL MANAGER
     *     description: |
     *       Retourne les statistiques opérationnelles pour les gestionnaires financiers :
     *       - 💰 Total collecté
     *       - ⏳ Cotisations en attente
     *       - ⚠️ Dettes actives
     *       - 📅 Cotisations en retard
     *       - 💵 Focus exécution (aujourd'hui/semaine)
     *       - 📊 Graphiques opérationnels
     *     tags: [Dashboard]
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
     *         description: Dashboard FINANCIAL MANAGER récupéré
     */
    this.router.get("/:organizationId/financial-manager", (req, res) =>
      this.controller.getFinancialManagerDashboard(req, res)
    );

    /**
     * @swagger
     * /api/statistiques/{organizationId}/member:
     *   get:
     *     summary: Récupérer le dashboard MEMBRE
     *     description: |
     *       Retourne les informations personnelles pour les membres :
     *       - 🧩 KPIs (total dû, payé, restant, en retard)
     *       - 🧩 Cotisations (actives, en retard, à venir)
     *       - 🧩 Dettes personnelles
     *       - 🧩 Activités récentes
     *       - 🧩 Historique
     *       - 🧩 Statistiques personnelles
     *     tags: [Dashboard]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: organizationId
     *         required: true
     *         schema:
     *           type: string
     *       - in: query
     *         name: membershipId
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Dashboard MEMBRE récupéré
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 data:
     *                   type: object
     *                   properties:
     *                     role:
     *                       type: string
     *                       example: "MEMBER"
     *                     organizationId:
     *                       type: string
     *                     membershipId:
     *                       type: string
     *                     memberInfo:
     *                       type: object
     *                     kpis:
     *                       type: object
     *                       properties:
     *                         totalDue:
     *                           type: number
     *                         totalPaid:
     *                           type: number
     *                         totalRemaining:
     *                           type: number
     *                         overdueAmount:
     *                           type: number
     *                     contributions:
     *                       type: object
     *                     debts:
     *                       type: object
     *                     recentActivities:
     *                       type: object
     *                     history:
     *                       type: array
     *                     statistics:
     *                       type: object
     */
    this.router.get("/:organizationId/member", (req, res) =>
      this.controller.getMemberDashboard(req, res)
    );

    /**
     * @swagger
     * /api/statistiques/{organizationId}/auto:
     *   get:
     *     summary: Récupérer le dashboard automatique selon le rôle
     *     description: |
     *       Retourne automatiquement le dashboard adapté au rôle de l'utilisateur dans l'organisation
     *       - ADMIN → Dashboard ADMIN
     *       - FINANCIAL_MANAGER → Dashboard FINANCIAL MANAGER
     *       - MEMBER → Dashboard MEMBRE
     *     tags: [Dashboard]
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
     *         description: Dashboard adapté au rôle récupéré
     */
    this.router.get("/:organizationId/auto", (req, res) =>
      this.controller.getAutoDashboard(req, res)
    );
  }

  get routes() {
    return this.router;
  }
}