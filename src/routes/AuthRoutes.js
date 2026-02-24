// routes/authRoutes.js

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
     *       description: "⚠️ Les tokens (accessToken et refreshToken) sont définis automatiquement dans les cookies HttpOnly et ne sont pas visibles dans la réponse JSON"
     *
     *     RegisterRequest:
     *       type: object
     *       required:
     *         - prenom
     *         - nom
     *         - email
     *         - password
     *         - phone
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
     *           example: "781234567"
     *
     *     LoginRequest:
     *       type: object
     *       required:
     *         - phone
     *         - password
     *       properties:
     *         phone:
     *           type: string
     *           example: "781254695"
     *         password:
     *           type: string
     *           format: password
     *           example: "Liverpool040"
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
     *     cookieAuth:
     *       type: apiKey
     *       in: cookie
     *       name: accessToken
     *       description: "Cookie HttpOnly contenant le JWT access token"
     *     bearerAuth:
     *       type: http
     *       scheme: bearer
     *       bearerFormat: JWT
     *       description: "Alternative : Header Authorization avec Bearer token (pour compatibilité)"
     */

    // Routes publiques

    /**
     * @swagger
     * /api/auth/register:
     *   post:
     *     summary: Inscription d'un nouvel utilisateur
     *     tags: [Authentication]
     *     security: []
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
     *         headers:
     *           Set-Cookie:
     *             description: Cookies HttpOnly contenant accessToken et refreshToken
     *             schema:
     *               type: string
     *               example: |
     *                 accessToken=eyJhbG...; Path=/; HttpOnly; SameSite=Lax
     *                 refreshToken=eyJhbG...; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000
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
     *         description: Email ou téléphone déjà utilisé
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
     *     summary: Connexion avec téléphone et mot de passe
     *     tags: [Authentication]
     *     security: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/LoginRequest'
     *     responses:
     *       200:
     *         description: Connexion réussie
     *         headers:
     *           Set-Cookie:
     *             description: Cookies HttpOnly contenant accessToken et refreshToken
     *             schema:
     *               type: string
     *               example: |
     *                 accessToken=eyJhbG...; Path=/; HttpOnly; SameSite=Lax
     *                 refreshToken=eyJhbG...; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000
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
     * /api/auth/refresh-token:
     *   post:
     *     summary: Rafraîchir l'access token
     *     tags: [Authentication]
     *     security: []
     *     description: |
     *       Permet d'obtenir un nouveau access token en utilisant le refresh token stocké dans les cookies.
     *       ⚠️ Le refresh token est automatiquement envoyé via les cookies, aucun body n'est nécessaire.
     *     responses:
     *       200:
     *         description: Token rafraîchi avec succès
     *         headers:
     *           Set-Cookie:
     *             description: Nouveau cookie accessToken
     *             schema:
     *               type: string
     *               example: accessToken=eyJhbG...; Path=/; HttpOnly; SameSite=Lax
     *         content:
     *           application/json:
     *             schema:
     *               allOf:
     *                 - $ref: '#/components/schemas/Success'
     *                 - type: object
     *                   properties:
     *                     message:
     *                       type: string
     *                       example: "Token rafraîchi avec succès"
     *       401:
     *         description: Refresh token invalide, révoqué ou expiré
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    this.router.post("/refresh-token", (req, res) =>
      this.controller.refreshToken(req, res)
    );

    // Routes protégées

    /**
     * @swagger
     * /api/auth/me:
     *   get:
     *     summary: Récupérer les informations de l'utilisateur connecté
     *     tags: [Authentication]
     *     security:
     *       - cookieAuth: []
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
     *       - cookieAuth: []
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
     * /api/auth/logout:
     *   post:
     *     summary: Déconnexion de l'utilisateur
     *     tags: [Authentication]
     *     security:
     *       - cookieAuth: []
     *     description: |
     *       Déconnecte l'utilisateur en révoquant le refresh token et en supprimant les cookies.
     *       ⚠️ Le refresh token est automatiquement récupéré depuis les cookies, aucun body n'est nécessaire.
     *     responses:
     *       200:
     *         description: Déconnexion réussie
     *         headers:
     *           Set-Cookie:
     *             description: Cookies supprimés (expiration immédiate)
     *             schema:
     *               type: string
     *               example: |
     *                 accessToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT
     *                 refreshToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT
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

    /**
     * @swagger
     * /api/auth/revoke-token:
     *   post:
     *     summary: Révoquer le refresh token actuel
     *     tags: [Authentication]
     *     security:
     *       - cookieAuth: []
     *     description: |
     *       Révoque le refresh token actuel de l'utilisateur.
     *       ⚠️ Le refresh token est automatiquement récupéré depuis les cookies.
     *     responses:
     *       200:
     *         description: Refresh token révoqué avec succès
     *         headers:
     *           Set-Cookie:
     *             description: Cookies supprimés
     *             schema:
     *               type: string
     *               example: |
     *                 accessToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT
     *                 refreshToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       400:
     *         description: Refresh token manquant ou invalide
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
    this.router.post(
      "/revoke-token",
      this.authMiddleware.protect(),
      (req, res) => this.controller.revokeRefreshToken(req, res)
    );

    /**
     * @swagger
     * /api/auth/revoke-all-tokens:
     *   post:
     *     summary: Révoquer tous les refresh tokens de l'utilisateur
     *     tags: [Authentication]
     *     security:
     *       - cookieAuth: []
     *     description: Déconnecte l'utilisateur de tous ses appareils en révoquant tous ses refresh tokens
     *     responses:
     *       200:
     *         description: Tous les refresh tokens ont été révoqués
     *         headers:
     *           Set-Cookie:
     *             description: Cookies supprimés
     *             schema:
     *               type: string
     *               example: |
     *                 accessToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT
     *                 refreshToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       400:
     *         description: Erreur lors de la révocation
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
    this.router.post(
      "/revoke-all-tokens",
      this.authMiddleware.protect(),
      (req, res) => this.controller.revokeAllTokens(req, res)
    );

    /**
     * @swagger
     * /api/auth/can-create-org:
     *   patch:
     *     summary: Mettre à jour le droit de création d'organisation (Admin seulement)
     *     tags: [Authentication]
     *     security:
     *       - cookieAuth: []
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
  }

  get routes() {
    return this.router;
  }
}