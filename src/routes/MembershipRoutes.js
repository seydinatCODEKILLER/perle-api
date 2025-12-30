import express from "express";
import MembershipController from "../controllers/MembershipController.js";
import AuthMiddleware from "../middlewares/AuthMiddleware.js";

export default class MembershipRoutes {
  constructor() {
    this.router = express.Router({ mergeParams: true });
    this.controller = new MembershipController();
    this.authMiddleware = new AuthMiddleware();

    this.setupRoutes();
  }

  setupRoutes() {
    this.router.use(this.authMiddleware.protect());

    /**
     * @swagger
     * /api/membership/{organizationId}/members:
     *   post:
     *     summary: Ajouter un nouveau membre à une organisation
     *     tags: [Memberships]
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
     *               phone:
     *                 type: string
     *                 description: Téléphone de l'utilisateur (si userId non fourni)
     *     responses:
     *       201:
     *         description: Membre ajouté avec succès
     */
    this.router.post("/:organizationId/members", (req, res) =>
      this.controller.createMembership(req, res)
    );

    /**
     * @swagger
     * /api/membership/{organizationId}/members:
     *   get:
     *     summary: Récupérer tous les membres d'une organisation
     *     tags: [Memberships]
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
     *           enum: [ACTIVE, INACTIVE, SUSPENDED]
     *       - in: query
     *         name: role
     *         schema:
     *           type: string
     *           enum: [ADMIN, FINANCIAL_MANAGER, MEMBER]
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
     *         description: Liste des membres
     */
    this.router.get("/:organizationId/members", (req, res) =>
      this.controller.getOrganizationMembers(req, res)
    );

    /**
     * @swagger
     * /api/membership/{organizationId}/members/{id}:
     *   get:
     *     summary: Récupérer un membre spécifique
     *     tags: [Memberships]
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
     *         description: Détails du membre
     */
    this.router.get("/:organizationId/members/:id", (req, res) =>
      this.controller.getMembership(req, res)
    );

    /**
     * @swagger
     * /api/membership/{organizationId}/members/{id}:
     *   put:
     *     summary: Mettre à jour les informations d'un membre
     *     tags: [Memberships]
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
     *               role:
     *                 type: string
     *                 enum: [ADMIN, FINANCIAL_MANAGER, MEMBER]
     *               memberNumber:
     *                 type: string
     *               joinDate:
     *                 type: string
     *                 format: date-time
     *     responses:
     *       200:
     *         description: Membre mis à jour
     */
    this.router.put("/:organizationId/members/:id", (req, res) =>
      this.controller.updateMembership(req, res)
    );

    /**
     * @swagger
     * /api/membership/{organizationId}/members/{id}/status:
     *   patch:
     *     summary: Mettre à jour le statut d'un membre
     *     tags: [Memberships]
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
     *                 enum: [ACTIVE, INACTIVE, SUSPENDED]
     *     responses:
     *       200:
     *         description: Statut mis à jour
     */
    this.router.patch("/:organizationId/members/:id/status", (req, res) =>
      this.controller.updateMembershipStatus(req, res)
    );

    /**
     * @swagger
     * /api/membership/{organizationId}/members/{id}/role:
     *   patch:
     *     summary: Mettre à jour le rôle d'un membre
     *     tags: [Memberships]
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
     *               - role
     *             properties:
     *               role:
     *                 type: string
     *                 enum: [ADMIN, FINANCIAL_MANAGER, MEMBER]
     *     responses:
     *       200:
     *         description: Rôle mis à jour
     */
    this.router.patch("/:organizationId/members/:id/role", (req, res) =>
      this.controller.updateMembershipRole(req, res)
    );

    /**
     * @swagger
     * /api/membership/{organizationId}/members/{id}:
     *   delete:
     *     summary: Supprimer un membre d'une organisation
     *     tags: [Memberships]
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
     *         description: Membre supprimé
     */
    this.router.delete("/:organizationId/members/:id", (req, res) =>
      this.controller.deleteMembership(req, res)
    );
  }

  get routes() {
    return this.router;
  }
}