// routes/OrganizationRoutes.js
import express from "express";
import OrganizationController from "../controllers/OrganizationController.js";
import AuthMiddleware from "../middlewares/AuthMiddleware.js";
import upload from "../config/multer.js";

export default class OrganizationRoutes {
  constructor() {
    this.router = express.Router();
    this.controller = new OrganizationController();
    this.authMiddleware = new AuthMiddleware();

    this.setupRoutes();
  }

  setupRoutes() {
    // Routes protégées
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
     *     responses:
     *       201:
     *         description: Organisation créée avec succès
     */
    this.router.post("/", upload.single("logo"), (req, res) =>
      this.controller.createOrganization(req, res)
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
      this.controller.getUserOrganizations(req, res)
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
      this.controller.searchOrganizations(req, res)
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
      this.controller.getOrganization(req, res)
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
      this.controller.updateOrganization(req, res)
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
      this.controller.updateOrganizationSettings(req, res)
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
      this.controller.getOrganizationStats(req, res)
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
      this.controller.deactivateOrganization(req, res)
    );
  }

  get routes() {
    return this.router;
  }
}
