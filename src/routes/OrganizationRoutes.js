import express from "express";
import OrganizationController from "../controllers/OrganizationController.js";
import AuthMiddleware from "../middlewares/AuthMiddleware.js";
import upload from "../config/multer.js";
import { parseNestedFormData } from "../middlewares/parseFormData.middleware.js";

export default class OrganizationRoutes {
  constructor() {
    this.router = express.Router();
    this.controller = new OrganizationController();
    this.authMiddleware = new AuthMiddleware();

    this.setupRoutes();
  }

  setupRoutes() {
    this.router.use(this.authMiddleware.protect());

    /**
     * @swagger
     * /api/organizations:
     *   post:
     *     summary: Créer une nouvelle organisation
     *     tags: [Organizations]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         multipart/form-data:
     *           schema:
     *             type: object
     *             required:
     *               - name
     *               - type
     *             properties:
     *               name:
     *                 type: string
     *                 example: "Ma Dahira"
     *               description:
     *                 type: string
     *                 example: "Description de mon organisation"
     *               type:
     *                 type: string
     *                 enum: [DAHIRA, ASSOCIATION, TONTINE, GROUPEMENT]
     *               currency:
     *                 type: string
     *                 default: "XOF"
     *               address:
     *                 type: string
     *               city:
     *                 type: string
     *               country:
     *                 type: string
     *                 default: "Sénégal"
     *               logo:
     *                 type: string
     *                 format: binary
     *               wallet.initialBalance:
     *                 type: number
     *                 description: "Solde initial du portefeuille (optionnel, défaut: 0)"
     *                 example: 100000
     *                 minimum: 0
     *               settings.allowPartialPayments:
     *                 type: boolean
     *                 default: false
     *               settings.autoReminders:
     *                 type: boolean
     *                 default: true
     *               settings.reminderDays:
     *                 type: array
     *                 items:
     *                   type: integer
     *                 default: [1, 3, 7]
     *               settings.emailNotifications:
     *                 type: boolean
     *                 default: true
     *               settings.smsNotifications:
     *                 type: boolean
     *                 default: false
     *               settings.whatsappNotifications:
     *                 type: boolean
     *                 default: false
     *               settings.sessionTimeout:
     *                 type: integer
     *                 default: 60
     *     responses:
     *       201:
     *         description: Organisation créée avec succès (avec wallet initialisé)
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
     *                     id:
     *                       type: string
     *                     name:
     *                       type: string
     *                     type:
     *                       type: string
     *                     currency:
     *                       type: string
     *                     walletCreated:
     *                       type: boolean
     *                       example: true
     *       400:
     *         description: Données invalides
     *       401:
     *         description: Non authentifié
     */
    this.router.post(
      "/",
      upload.single("logo"),
      parseNestedFormData,
      (req, res) => this.controller.createOrganization(req, res),
    );

    /**
     * @swagger
     * /api/organizations:
     *   get:
     *     summary: Récupérer les organisations de l'utilisateur
     *     tags: [Organizations]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Liste des organisations
     */
    this.router.get("/", (req, res) =>
      this.controller.getUserOrganizations(req, res),
    );

    /**
     * @swagger
     * /api/organizations/inactive:
     *   get:
     *     summary: Récupérer les organisations inactives de l'utilisateur
     *     tags: [Organizations]
     *     security:
     *       - bearerAuth: []
     *     description: Retourne la liste des organisations désactivées dont l'utilisateur est membre
     *     parameters:
     *       - in: query
     *         name: page
     *         schema:
     *           type: integer
     *           default: 1
     *           minimum: 1
     *         description: Numéro de la page
     *       - in: query
     *         name: limit
     *         schema:
     *           type: integer
     *           default: 10
     *           minimum: 1
     *           maximum: 100
     *         description: Nombre d'organisations par page
     *     responses:
     *       200:
     *         description: Liste des organisations inactives récupérée avec succès
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
     *                   example: "Organisations inactives récupérées avec succès"
     *                 data:
     *                   type: object
     *                   properties:
     *                     organizations:
     *                       type: array
     *                       items:
     *                         $ref: '#/components/schemas/Organization'
     *                     pagination:
     *                       type: object
     *                       properties:
     *                         page:
     *                           type: integer
     *                           example: 1
     *                         limit:
     *                           type: integer
     *                           example: 10
     *                         total:
     *                           type: integer
     *                           example: 25
     *                         pages:
     *                           type: integer
     *                           example: 3
     *                         hasNext:
     *                           type: boolean
     *                           example: true
     *                         hasPrev:
     *                           type: boolean
     *                           example: false
     *       400:
     *         description: Erreur de requête
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                   example: false
     *                 message:
     *                   type: string
     *       401:
     *         description: Non authentifié
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    this.router.get("/inactive", (req, res) =>
      this.controller.getInactiveOrganizations(req, res),
    );

    /**
     * @swagger
     * /api/organizations/search:
     *   get:
     *     summary: Rechercher des organisations
     *     tags: [Organizations]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: query
     *         name: search
     *         schema:
     *           type: string
     *         description: Terme de recherche
     *       - in: query
     *         name: type
     *         schema:
     *           type: string
     *           enum: [DAHIRA, ASSOCIATION, TONTINE, GROUPEMENT]
     *         description: Type d'organisation
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
     *         description: Résultats de la recherche
     */
    this.router.get("/search", (req, res) =>
      this.controller.searchOrganizations(req, res),
    );

    /**
     * @swagger
     * /api/organizations/{id}:
     *   get:
     *     summary: Récupérer une organisation par ID
     *     tags: [Organizations]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Détails de l'organisation
     */
    this.router.get("/:id", (req, res) =>
      this.controller.getOrganization(req, res),
    );

    /**
     * @swagger
     * /api/organizations/{id}:
     *   put:
     *     summary: Mettre à jour une organisation
     *     tags: [Organizations]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     requestBody:
     *       required: true
     *       content:
     *         multipart/form-data:
     *           schema:
     *             type: object
     *             properties:
     *               name:
     *                 type: string
     *               description:
     *                 type: string
     *               type:
     *                 type: string
     *                 enum: [DAHIRA, ASSOCIATION, TONTINE, GROUPEMENT]
     *               currency:
     *                 type: string
     *               address:
     *                 type: string
     *               city:
     *                 type: string
     *               country:
     *                 type: string
     *               logo:
     *                 type: string
     *                 format: binary
     *     responses:
     *       200:
     *         description: Organisation mise à jour
     */
    this.router.put("/:id", upload.single("logo"), (req, res) =>
      this.controller.updateOrganization(req, res),
    );

    /**
     * @swagger
     * /api/organizations/{id}/settings:
     *   patch:
     *     summary: Mettre à jour les paramètres d'une organisation
     *     tags: [Organizations]
     *     security:
     *       - bearerAuth: []
     *     parameters:
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
     *               allowPartialPayments:
     *                 type: boolean
     *               autoReminders:
     *                 type: boolean
     *               reminderDays:
     *                 type: array
     *                 items:
     *                   type: integer
     *               emailNotifications:
     *                 type: boolean
     *               smsNotifications:
     *                 type: boolean
     *               whatsappNotifications:
     *                 type: boolean
     *               sessionTimeout:
     *                 type: integer
     *     responses:
     *       200:
     *         description: Paramètres mis à jour
     */
    this.router.patch("/:id/settings", (req, res) =>
      this.controller.updateOrganizationSettings(req, res),
    );

    /**
     * @swagger
     * /api/organizations/{id}/stats:
     *   get:
     *     summary: Récupérer les statistiques d'une organisation
     *     tags: [Organizations]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Statistiques de l'organisation
     */
    this.router.get("/:id/stats", (req, res) =>
      this.controller.getOrganizationStats(req, res),
    );

    /**
     * @swagger
     * /api/organizations/{id}/deactivate:
     *   patch:
     *     summary: Désactiver une organisation
     *     tags: [Organizations]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Organisation désactivée
     */
    this.router.patch("/:id/deactivate", (req, res) =>
      this.controller.deactivateOrganization(req, res),
    );

    /**
     * @swagger
     * /api/organizations/{id}/reactivate:
     *   patch:
     *     summary: Réactiver une organisation désactivée
     *     tags: [Organizations]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: ID de l'organisation à réactiver
     *     responses:
     *       200:
     *         description: Organisation réactivée avec succès
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
     *                   example: "Organisation réactivée avec succès"
     *                 data:
     *                   $ref: '#/components/schemas/Organization'
     *       400:
     *         description: Erreur (organisation non trouvée ou permissions insuffisantes)
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                   example: false
     *                 message:
     *                   type: string
     */
    this.router.patch("/:id/reactivate", (req, res) =>
      this.controller.reactivateOrganization(req, res),
    );

    /**
     * @swagger
     * /api/organizations/{id}/wallet:
     *   patch:
     *     summary: Mettre à jour le portefeuille d'une organisation
     *     tags: [Organizations, Wallet]
     *     security:
     *       - bearerAuth: []
     *     description: |
     *       Met à jour les champs du portefeuille (currentBalance, initialBalance, totalIncome, totalExpenses).
     *       Seuls les ADMINs et le propriétaire peuvent effectuer cette opération.
     *       ⚠️ ATTENTION : À utiliser uniquement pour des ajustements manuels.
     *       Pour les opérations normales (contributions, dépenses), utilisez les endpoints dédiés.
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: ID de l'organisation
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               currentBalance:
     *                 type: number
     *                 description: "Nouveau solde actuel"
     *                 example: 50000
     *               initialBalance:
     *                 type: number
     *                 description: "Nouveau solde initial"
     *                 example: 100000
     *               totalIncome:
     *                 type: number
     *                 description: "Total des revenus"
     *                 example: 500000
     *               totalExpenses:
     *                 type: number
     *                 description: "Total des dépenses"
     *                 example: 450000
     *     responses:
     *       200:
     *         description: Portefeuille mis à jour avec succès
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
     *                   example: "Portefeuille mis à jour avec succès"
     *                 data:
     *                   type: object
     *                   properties:
     *                     id:
     *                       type: string
     *                     organizationId:
     *                       type: string
     *                     currentBalance:
     *                       type: number
     *                     initialBalance:
     *                       type: number
     *                     totalIncome:
     *                       type: number
     *                     totalExpenses:
     *                       type: number
     *                     currency:
     *                       type: string
     *       400:
     *         description: Données invalides
     *       403:
     *         description: Permissions insuffisantes
     *       404:
     *         description: Organisation ou portefeuille non trouvé
     *       401:
     *         description: Non authentifié
     */
    this.router.patch("/:id/wallet", (req, res) =>
      this.controller.updateWallet(req, res),
    );

    /**
     * @swagger
     * /api/organizations/{id}/wallet/settle:
     *   patch:
     *     summary: Solder le portefeuille d'une organisation (remettre à 0)
     *     tags: [Organizations, Wallet]
     *     security:
     *       - bearerAuth: []
     *     description: |
     *       Remet le solde du portefeuille à 0. Seul le propriétaire peut effectuer cette opération.
     *       L'historique (totalIncome, totalExpenses, initialBalance) est conservé.
     *       Une transaction de type WALLET_SETTLEMENT et un audit log sont créés automatiquement.
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: ID de l'organisation
     *     responses:
     *       200:
     *         description: Portefeuille soldé avec succès
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
     *                   example: "Portefeuille soldé avec succès"
     *                 data:
     *                   type: object
     *                   properties:
     *                     wallet:
     *                       type: object
     *                       properties:
     *                         id:
     *                           type: string
     *                         organizationId:
     *                           type: string
     *                         currentBalance:
     *                           type: number
     *                           example: 0
     *                         initialBalance:
     *                           type: number
     *                           example: 100000
     *                         totalIncome:
     *                           type: number
     *                           example: 500000
     *                         totalExpenses:
     *                           type: number
     *                           example: 450000
     *                         currency:
     *                           type: string
     *                           example: "XOF"
     *                     previousBalance:
     *                       type: number
     *                       example: 50000
     *                       description: "Solde avant le règlement"
     *                     newBalance:
     *                       type: number
     *                       example: 0
     *                     currency:
     *                       type: string
     *                       example: "XOF"
     *                     message:
     *                       type: string
     *                       example: "Portefeuille soldé avec succès. Solde précédent: 50000 XOF"
     *       400:
     *         description: Erreur (portefeuille déjà soldé, pas de portefeuille, etc.)
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                   example: false
     *                 message:
     *                   type: string
     *                   example: "Le portefeuille est déjà soldé (solde = 0)"
     *       403:
     *         description: Permissions insuffisantes (pas le propriétaire)
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                   example: false
     *                 message:
     *                   type: string
     *                   example: "Seul le propriétaire peut solder le portefeuille"
     *       404:
     *         description: Organisation non trouvée
     *       401:
     *         description: Non authentifié
     */
    this.router.patch("/:id/wallet/settle", (req, res) =>
      this.controller.settleWallet(req, res),
    );
  }

  get routes() {
    return this.router;
  }
}
