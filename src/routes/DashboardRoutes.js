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
     * /api/statistiques/{organizationId}:
     *   get:
     *     summary: Récupérer le dashboard par défaut selon le rôle
     *     description: |
     *       🎯 **Route principale - Redirection intelligente**
     *
     *       Cette route détecte automatiquement le rôle de l'utilisateur et retourne
     *       le dashboard approprié avec une suggestion de redirection.
     *
     *       **Comportement par rôle :**
     *       - 👤 **MEMBER** → Dashboard personnel (`redirectTo: "personal"`)
     *       - 💼 **FINANCIAL_MANAGER** → Dashboard de gestion (`redirectTo: "management"`)
     *       - 👑 **ADMIN** → Dashboard de gestion (`redirectTo: "management"`)
     *
     *       **Note :** Cette route est utilisée pour la navigation initiale.
     *       Le frontend devrait ensuite utiliser les routes spécifiques selon l'espace.
     *     tags: [Dashboard]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: organizationId
     *         required: true
     *         schema:
     *           type: string
     *         description: ID de l'organisation
     *     responses:
     *       200:
     *         description: Dashboard récupéré avec suggestion de redirection
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                   example: true
     *                 message:
     *                   type: string
     *                   example: "Dashboard récupéré avec succès"
     *                 data:
     *                   type: object
     *                   properties:
     *                     redirectTo:
     *                       type: string
     *                       enum: [personal, management]
     *                       description: Suggestion d'espace à afficher
     *                       example: "management"
     *                     data:
     *                       type: object
     *                       description: Données du dashboard
     *       403:
     *         description: Permissions insuffisantes
     *       401:
     *         description: Non authentifié
     */
    this.router.get("/:organizationId", (req, res) =>
      this.controller.getDefaultDashboard(req, res),
    );

    /**
     * @swagger
     * /api/statistiques/{organizationId}/management:
     *   get:
     *     summary: Récupérer le dashboard de GESTION
     *     description: |
     *       💼 **Dashboard de gestion de l'organisation**
     *
     *       Accessible uniquement par les **ADMIN** et **FINANCIAL_MANAGER**.
     *
     *       **Données retournées :**
     *       - 👥 **KPIs** : Membres actifs, total collecté, cotisations en attente, dettes actives
     *       - 💰 **Résumé financier** : Total à collecter, collecté, restant, en retard
     *       - 📊 **Graphiques** : Distribution des membres, évolution des cotisations
     *       - 📋 **Activités récentes** : Dernières transactions et événements
     *       - 🎯 **Abonnement** : Informations sur le plan actuel
     *
     *       **Différences ADMIN vs FINANCIAL_MANAGER :**
     *       - ADMIN : Accès complet + statistiques d'abonnement
     *       - FINANCIAL_MANAGER : Focus sur les opérations financières
     *     tags: [Dashboard]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: organizationId
     *         required: true
     *         schema:
     *           type: string
     *         description: ID de l'organisation
     *     responses:
     *       200:
     *         description: Dashboard de gestion récupéré
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 message:
     *                   type: string
     *                 data:
     *                   type: object
     *                   properties:
     *                     role:
     *                       type: string
     *                       enum: [ADMIN, FINANCIAL_MANAGER]
     *                       example: "ADMIN"
     *                     organizationId:
     *                       type: string
     *                     generatedAt:
     *                       type: string
     *                       format: date-time
     *                     currency:
     *                       type: string
     *                       example: "XOF"
     *                     kpis:
     *                       type: object
     *                       properties:
     *                         activeMembers:
     *                           type: object
     *                           properties:
     *                             value:
     *                               type: integer
     *                               example: 42
     *                             label:
     *                               type: string
     *                               example: "Membres actifs"
     *                             icon:
     *                               type: string
     *                               example: "Users"
     *                             trend:
     *                               type: object
     *                               properties:
     *                                 value:
     *                                   type: number
     *                                   example: 5.2
     *                                 direction:
     *                                   type: string
     *                                   enum: [up, down]
     *                         totalCollected:
     *                           type: object
     *                           properties:
     *                             value:
     *                               type: number
     *                               example: 1250000
     *                             label:
     *                               type: string
     *                             icon:
     *                               type: string
     *                         pendingContributions:
     *                           type: object
     *                         activeDebts:
     *                           type: object
     *                         overdueContributions:
     *                           type: object
     *                     financialOverview:
     *                       type: object
     *                       properties:
     *                         totalExpected:
     *                           type: number
     *                         totalCollected:
     *                           type: number
     *                         totalRemaining:
     *                           type: number
     *                         totalOverdue:
     *                           type: number
     *                         collectionRate:
     *                           type: number
     *                           description: Taux de recouvrement en %
     *                     charts:
     *                       type: object
     *                       properties:
     *                         memberStatus:
     *                           type: object
     *                         contributionTrends:
     *                           type: array
     *                     subscription:
     *                       type: object
     *                       description: Uniquement pour ADMIN
     *                     recentActivities:
     *                       type: array
     *                       items:
     *                         type: object
     *       403:
     *         description: Permissions insuffisantes (réservé aux ADMIN et FINANCIAL_MANAGER)
     *       401:
     *         description: Non authentifié
     */
    this.router.get("/:organizationId/management", (req, res) =>
      this.controller.getManagementDashboard(req, res),
    );

    /**
     * @swagger
     * /api/statistiques/{organizationId}/personal:
     *   get:
     *     summary: Récupérer le dashboard PERSONNEL
     *     description: |
     *       👤 **Dashboard personnel du membre**
     *
     *       ✅ **Accessible par TOUS les rôles** (ADMIN, FINANCIAL_MANAGER, MEMBER)
     *
     *       Pourquoi ? Car même les ADMIN et FINANCIAL_MANAGER sont des membres
     *       de l'organisation avec leurs propres cotisations et dettes personnelles.
     *
     *       **Données retournées :**
     *       - 📊 **KPIs personnels** : Total dû, payé, restant, en retard
     *       - 📝 **Informations du membre** : Numéro, statut, date d'adhésion
     *       - 💰 **Cotisations** :
     *         - Actives (en cours)
     *         - En retard (overdue)
     *         - À venir (upcoming)
     *       - 💳 **Dettes personnelles** : Liste et agrégats
     *       - 🕐 **Activités récentes** : Paiements et remboursements
     *       - 📜 **Historique** : Historique complet des paiements
     *       - 📈 **Statistiques** : Régularité, délai moyen de paiement
     *
     *       **Note importante :** Le backend détermine automatiquement le membershipId
     *       depuis le token JWT. Le frontend n'a pas besoin de le fournir.
     *     tags: [Dashboard]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: organizationId
     *         required: true
     *         schema:
     *           type: string
     *         description: ID de l'organisation
     *     responses:
     *       200:
     *         description: Dashboard personnel récupéré
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 message:
     *                   type: string
     *                 data:
     *                   type: object
     *                   properties:
     *                     role:
     *                       type: string
     *                       enum: [ADMIN, FINANCIAL_MANAGER, MEMBER]
     *                       example: "MEMBER"
     *                     organizationId:
     *                       type: string
     *                     membershipId:
     *                       type: string
     *                       description: ID du membership (déterminé automatiquement)
     *                     generatedAt:
     *                       type: string
     *                       format: date-time
     *                     memberInfo:
     *                       type: object
     *                       properties:
     *                         memberNumber:
     *                           type: string
     *                           example: "MBR001"
     *                         fullName:
     *                           type: string
     *                           example: "Jean Dupont"
     *                         email:
     *                           type: string
     *                         phone:
     *                           type: string
     *                         avatar:
     *                           type: string
     *                         joinDate:
     *                           type: string
     *                           format: date-time
     *                         status:
     *                           type: string
     *                           enum: [ACTIVE, INACTIVE, SUSPENDED]
     *                         role:
     *                           type: string
     *                     kpis:
     *                       type: object
     *                       properties:
     *                         totalDue:
     *                           type: number
     *                           description: Total à payer
     *                           example: 50000
     *                         totalPaid:
     *                           type: number
     *                           description: Total déjà payé
     *                           example: 35000
     *                         totalRemaining:
     *                           type: number
     *                           description: Reste à payer
     *                           example: 15000
     *                         overdueAmount:
     *                           type: number
     *                           description: Montant en retard
     *                           example: 5000
     *                     contributions:
     *                       type: object
     *                       properties:
     *                         active:
     *                           type: array
     *                           description: Cotisations en cours
     *                           items:
     *                             type: object
     *                         overdue:
     *                           type: array
     *                           description: Cotisations en retard
     *                         upcoming:
     *                           type: array
     *                           description: Cotisations à venir
     *                     debts:
     *                       type: object
     *                       properties:
     *                         list:
     *                           type: array
     *                           items:
     *                             type: object
     *                             properties:
     *                               id:
     *                                 type: string
     *                               title:
     *                                 type: string
     *                               initialAmount:
     *                                 type: number
     *                               remainingAmount:
     *                                 type: number
     *                               status:
     *                                 type: string
     *                               percentagePaid:
     *                                 type: number
     *                         aggregates:
     *                           type: object
     *                           properties:
     *                             activeDebtsCount:
     *                               type: integer
     *                             totalDebtRemaining:
     *                               type: number
     *                     recentActivities:
     *                       type: object
     *                       properties:
     *                         payments:
     *                           type: array
     *                           description: Paiements récents
     *                         repayments:
     *                           type: array
     *                           description: Remboursements récents
     *                     history:
     *                       type: array
     *                       description: Historique complet
     *                     statistics:
     *                       type: object
     *                       properties:
     *                         totalTransactions:
     *                           type: integer
     *                         averagePaymentDelay:
     *                           type: number
     *                           description: Délai moyen en jours
     *                         paymentRegularityRate:
     *                           type: number
     *                           description: Taux de régularité en %
     *                         onTimePayments:
     *                           type: integer
     *                         latePayments:
     *                           type: integer
     *       403:
     *         description: Utilisateur non membre de l'organisation
     *       401:
     *         description: Non authentifié
     */
    this.router.get("/:organizationId/personal", (req, res) =>
      this.controller.getPersonalDashboard(req, res),
    );

    /**
     * @swagger
     * /api/statistiques/{organizationId}/auto:
     *   get:
     *     summary: Récupérer le dashboard AUTO avec sélection d'espace
     *     description: |
     *       🔄 **Route flexible avec paramètre d'espace**
     *
     *       Cette route permet de récupérer un dashboard spécifique en fonction
     *       du paramètre `space` fourni en query.
     *
     *       **Utilisation :**
     *       - `?space=management` → Dashboard de gestion (si permissions)
     *       - `?space=personal` → Dashboard personnel (tous)
     *
     *       **Cas d'erreur :**
     *       Si un MEMBER tente d'accéder à `space=management`, une erreur 403 est retournée.
     *
     *       **Cas d'usage :**
     *       - Switch entre espaces pour ADMIN/FINANCIAL_MANAGER
     *       - Accès direct à un espace spécifique
     *       - Navigation conditionnelle
     *     tags: [Dashboard]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: organizationId
     *         required: true
     *         schema:
     *           type: string
     *         description: ID de l'organisation
     *       - in: query
     *         name: space
     *         required: false
     *         schema:
     *           type: string
     *           enum: [personal, management]
     *           default: management
     *         description: Espace souhaité (par défaut "management")
     *     responses:
     *       200:
     *         description: Dashboard de l'espace demandé
     *       403:
     *         description: Permissions insuffisantes pour l'espace demandé
     *       401:
     *         description: Non authentifié
     *       400:
     *         description: Espace invalide
     */
    this.router.get("/:organizationId/auto", (req, res) =>
      this.controller.getAutoDashboard(req, res),
    );
  }

  get routes() {
    return this.router;
  }
}
