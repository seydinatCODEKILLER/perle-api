// routes/AuthRoutes.js
import express from "express";
import AuthController from "../controllers/AuthController.js";
import AuthMiddleware from "../middlewares/AuthMiddleware.js";
import upload from "../config/multer.js";

export default class AuthRoutes {
  constructor() {
    this.router = express.Router();
    this.controller = new AuthController();
    this.authMiddleware = new AuthMiddleware();

    this.setupRoutes();
  }

  setupRoutes() {
    /**
     * @swagger
     * components:
     *   schemas:
     *     User:
     *       type: object
     *       properties:
     *         id:
     *           type: string
     *           example: "507f1f77bcf86cd799439011"
     *         prenom:
     *           type: string
     *           example: "Jean"
     *         nom:
     *           type: string
     *           example: "Dupont"
     *         email:
     *           type: string
     *           example: "jean.dupont@email.com"
     *         phone:
     *           type: string
     *           example: "+221781234567"
     *         avatar:
     *           type: string
     *           example: "https://example.com/avatar.jpg"
     *         role:
     *           type: string
     *           enum: [SUPER_ADMIN, ADMIN, MEMBER]
     *           example: "MEMBER"
     *         isActive:
     *           type: boolean
     *           example: true
     *         canCreateOrganization:
     *           type: boolean
     *           example: true
     *         createdAt:
     *           type: string
     *           format: date-time
     *         updatedAt:
     *           type: string
     *           format: date-time
     *         lastLoginAt:
     *           type: string
     *           format: date-time
     *
     *     AuthResponse:
     *       type: object
     *       properties:
     *         user:
     *           $ref: '#/components/schemas/User'
     *         token:
     *           type: string
     *           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
     *
     *     RegisterRequest:
     *       type: object
     *       required:
     *         - prenom
     *         - nom
     *         - email
     *         - password
     *       properties:
     *         prenom:
     *           type: string
     *           minLength: 2
     *           example: "Jean"
     *         nom:
     *           type: string
     *           minLength: 2
     *           example: "Dupont"
     *         email:
     *           type: string
     *           format: email
     *           example: "jean.dupont@email.com"
     *         password:
     *           type: string
     *           format: password
     *           minLength: 8
     *           example: "MonMotDePasse123!"
     *         phone:
     *           type: string
     *           example: "+221781234567"
     *
     *     LoginRequest:
     *       type: object
     *       required:
     *         - email
     *         - password
     *       properties:
     *         email:
     *           type: string
     *           format: email
     *           example: "jean.dupont@email.com"
     *         password:
     *           type: string
     *           format: password
     *           example: "MonMotDePasse123!"
     *
     *     LoginCodeRequest:
     *       type: object
     *       required:
     *         - email
     *       properties:
     *         email:
     *           type: string
     *           format: email
     *           example: "jean.dupont@email.com"
     *
     *     VerifyLoginCodeRequest:
     *       type: object
     *       required:
     *         - email
     *         - loginCode
     *       properties:
     *         email:
     *           type: string
     *           format: email
     *           example: "jean.dupont@email.com"
     *         loginCode:
     *           type: string
     *           length: 6
     *           example: "123456"
     *
     *     ForgotPasswordRequest:
     *       type: object
     *       required:
     *         - email
     *       properties:
     *         email:
     *           type: string
     *           format: email
     *           example: "jean.dupont@email.com"
     *
     *     ResetPasswordRequest:
     *       type: object
     *       required:
     *         - token
     *         - newPassword
     *       properties:
     *         token:
     *           type: string
     *           example: "12345678-1234-1234-1234-123456789abc"
     *         newPassword:
     *           type: string
     *           format: password
     *           minLength: 8
     *           example: "NouveauMotDePasse123!"
     *
     *     UpdateProfileRequest:
     *       type: object
     *       properties:
     *         prenom:
     *           type: string
     *           minLength: 2
     *           example: "Jean"
     *         nom:
     *           type: string
     *           minLength: 2
     *           example: "Dupont"
     *         phone:
     *           type: string
     *           example: "+221781234567"
     *
     *     UpdateCanCreateOrgRequest:
     *       type: object
     *       required:
     *         - userId
     *         - canCreateOrganization
     *       properties:
     *         userId:
     *           type: string
     *           example: "507f1f77bcf86cd799439011"
     *         canCreateOrganization:
     *           type: boolean
     *           example: true
     *
     *     Success:
     *       type: object
     *       properties:
     *         success:
     *           type: boolean
     *           example: true
     *         message:
     *           type: string
     *           example: "Opération réussie"
     *         data:
     *           type: object
     *
     *     Error:
     *       type: object
     *       properties:
     *         success:
     *           type: boolean
     *           example: false
     *         message:
     *           type: string
     *           example: "Une erreur est survenue"
     *         error:
     *           type: string
     *           example: "Détails de l'erreur"
     *
     *   securitySchemes:
     *     bearerAuth:
     *       type: http
     *       scheme: bearer
     *       bearerFormat: JWT
     */

    // Routes publiques

    /**
     * @swagger
     * /api/auth/register:
     *   post:
     *     summary: Inscription d'un nouvel utilisateur
     *     tags: [Authentication]
     *     requestBody:
     *       required: true
     *       content:
     *         multipart/form-data:
     *           schema:
     *             allOf:
     *               - $ref: '#/components/schemas/RegisterRequest'
     *               - type: object
     *                 properties:
     *                   avatar:
     *                     type: string
     *                     format: binary
     *                     description: Image d'avatar (optionnelle, max 5MB)
     *     responses:
     *       201:
     *         description: Utilisateur créé avec succès
     *         content:
     *           application/json:
     *             schema:
     *               allOf:
     *                 - $ref: '#/components/schemas/Success'
     *                 - type: object
     *                   properties:
     *                     data:
     *                       $ref: '#/components/schemas/AuthResponse'
     *       400:
     *         description: Données invalides ou mot de passe faible
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       409:
     *         description: Email déjà utilisé
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    this.router.post("/register", upload.single("avatar"), (req, res) =>
      this.controller.register(req, res)
    );

    /**
     * @swagger
     * /api/auth/login:
     *   post:
     *     summary: Connexion avec email et mot de passe
     *     tags: [Authentication]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/LoginRequest'
     *     responses:
     *       200:
     *         description: Connexion réussie
     *         content:
     *           application/json:
     *             schema:
     *               allOf:
     *                 - $ref: '#/components/schemas/Success'
     *                 - type: object
     *                   properties:
     *                     data:
     *                       $ref: '#/components/schemas/AuthResponse'
     *       400:
     *         description: Données invalides
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       401:
     *         description: Identifiants incorrects
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       403:
     *         description: Compte désactivé
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    this.router.post("/login", (req, res) => this.controller.login(req, res));

    /**
     * @swagger
     * /api/auth/send-login-code:
     *   post:
     *     summary: Envoyer un code de connexion par email
     *     tags: [Authentication]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/LoginCodeRequest'
     *     responses:
     *       200:
     *         description: Code envoyé avec succès (si l'email existe)
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       400:
     *         description: Email invalide
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       403:
     *         description: Compte désactivé
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    this.router.post("/send-login-code", (req, res) =>
      this.controller.sendLoginCode(req, res)
    );

    /**
     * @swagger
     * /api/auth/verify-login-code:
     *   post:
     *     summary: Vérifier un code de connexion
     *     tags: [Authentication]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/VerifyLoginCodeRequest'
     *     responses:
     *       200:
     *         description: Connexion réussie avec code
     *         content:
     *           application/json:
     *             schema:
     *               allOf:
     *                 - $ref: '#/components/schemas/Success'
     *                 - type: object
     *                   properties:
     *                     data:
     *                       $ref: '#/components/schemas/AuthResponse'
     *       400:
     *         description: Code invalide ou manquant
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       401:
     *         description: Code incorrect ou expiré
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       403:
     *         description: Compte désactivé
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    this.router.post("/verify-login-code", (req, res) =>
      this.controller.verifyLoginCode(req, res)
    );

    /**
     * @swagger
     * /api/auth/forgot-password:
     *   post:
     *     summary: Demande de réinitialisation de mot de passe
     *     tags: [Authentication]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/ForgotPasswordRequest'
     *     responses:
     *       200:
     *         description: Email envoyé avec succès (si l'email existe)
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       400:
     *         description: Email invalide
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       403:
     *         description: Compte désactivé
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    this.router.post("/forgot-password", (req, res) =>
      this.controller.forgotPassword(req, res)
    );

    /**
     * @swagger
     * /api/auth/reset-password:
     *   post:
     *     summary: Réinitialisation du mot de passe
     *     tags: [Authentication]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/ResetPasswordRequest'
     *     responses:
     *       200:
     *         description: Mot de passe réinitialisé avec succès
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       400:
     *         description: Token invalide ou mot de passe faible
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       404:
     *         description: Token expiré ou non trouvé
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    this.router.post("/reset-password", (req, res) =>
      this.controller.resetPassword(req, res)
    );

    // Routes protégées

    /**
     * @swagger
     * /api/auth/me:
     *   get:
     *     summary: Récupérer les informations de l'utilisateur connecté
     *     tags: [Authentication]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Informations utilisateur récupérées avec succès
     *         content:
     *           application/json:
     *             schema:
     *               allOf:
     *                 - $ref: '#/components/schemas/Success'
     *                 - type: object
     *                   properties:
     *                     data:
     *                       $ref: '#/components/schemas/User'
     *       401:
     *         description: Non authentifié
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       404:
     *         description: Utilisateur non trouvé
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    this.router.get("/me", this.authMiddleware.protect(), (req, res) =>
      this.controller.getCurrentUser(req, res)
    );

    /**
     * @swagger
     * /api/auth/profile:
     *   put:
     *     summary: Mettre à jour le profil utilisateur
     *     tags: [Authentication]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         multipart/form-data:
     *           schema:
     *             allOf:
     *               - $ref: '#/components/schemas/UpdateProfileRequest'
     *               - type: object
     *                 properties:
     *                   avatar:
     *                     type: string
     *                     format: binary
     *                     description: Nouvelle image d'avatar (optionnelle, max 5MB)
     *     responses:
     *       200:
     *         description: Profil mis à jour avec succès
     *         content:
     *           application/json:
     *             schema:
     *               allOf:
     *                 - $ref: '#/components/schemas/Success'
     *                 - type: object
     *                   properties:
     *                     data:
     *                       $ref: '#/components/schemas/User'
     *       400:
     *         description: Données invalides
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       401:
     *         description: Non authentifié
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    this.router.put(
      "/profile",
      this.authMiddleware.protect(),
      upload.single("avatar"),
      (req, res) => this.controller.updateProfile(req, res)
    );

    /**
     * @swagger
     * /api/auth/can-create-org:
     *   patch:
     *     summary: Mettre à jour le droit de création d'organisation (Admin seulement)
     *     tags: [Authentication]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/UpdateCanCreateOrgRequest'
     *     responses:
     *       200:
     *         description: Droit de création mis à jour avec succès
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       400:
     *         description: Données invalides
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       401:
     *         description: Non authentifié
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       403:
     *         description: Permissions insuffisantes
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    this.router.patch(
      "/can-create-org",
      this.authMiddleware.protect(),
      this.authMiddleware.restrictTo("SUPER_ADMIN", "ADMIN"),
      (req, res) => this.controller.updateCanCreateOrganization(req, res)
    );

    /**
     * @swagger
     * /api/auth/logout:
     *   post:
     *     summary: Déconnexion de l'utilisateur
     *     tags: [Authentication]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Déconnexion réussie
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         description: Non authentifié
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       500:
     *         description: Erreur serveur lors de la déconnexion
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    this.router.post("/logout", this.authMiddleware.protect(), (req, res) =>
      this.controller.logout(req, res)
    );
  }

  get routes() {
    return this.router;
  }
}
