import AuthService from "../services/AuthService.js";
import AuthSchema from "../schemas/AuthSchema.js";
import { CookieManager } from "../utils/cookie.utils.js";

export default class AuthController {
  constructor() {
    this.service = new AuthService();
    this.schema = new AuthSchema();
  }

  async register(req, res) {
    try {
      this.schema.validateRegister(req.body);

      const { prenom, nom, email, password, phone } = req.body;
      const avatarFile = req.file;

      const result = await this.service.register({
        prenom,
        nom,
        email,
        password,
        phone,
        avatarFile,
      });

      // ✅ Définir les cookies au lieu de renvoyer les tokens
      CookieManager.setAuthTokens(
        res,
        result.accessToken,
        result.refreshToken
      );

      // ✅ Retourner uniquement les données utilisateur
      return res.success(
        { user: result.user },
        "Inscription réussie",
        201
      );
    } catch (error) {
      return res.error(error.message, 400);
    }
  }

  async login(req, res) {
    try {
      // Validation des données
      this.schema.validateLogin(req.body);
      const { phone, password } = req.body;

      const result = await this.service.login(phone, password);

      // ✅ Définir les cookies au lieu de renvoyer les tokens
      CookieManager.setAuthTokens(
        res,
        result.accessToken,
        result.refreshToken
      );

      // ✅ Retourner uniquement les données utilisateur
      return res.success(
        { user: result.user },
        "Connexion réussie"
      );
    } catch (error) {
      const statusCode = error.message.includes("incorrect")
        ? 401
        : error.message.includes("inactif")
        ? 403
        : 400;
      return res.error(error.message, statusCode);
    }
  }

  async logout(req, res) {
    try {
      // ✅ Récupérer le refresh token depuis les cookies
      const refreshToken = CookieManager.getRefreshToken(req);

      if (refreshToken) {
        await this.service.logout(refreshToken);
      }

      // ✅ Supprimer tous les cookies d'authentification
      CookieManager.clearAuthCookies(res);

      return res.success(null, "Déconnexion réussie");
    } catch (error) {
      // ✅ Supprimer les cookies même en cas d'erreur
      CookieManager.clearAuthCookies(res);
      return res.error("Erreur lors de la déconnexion", 500);
    }
  }

  async getCurrentUser(req, res) {
    try {
      const userId = req.user.id;
      const user = await this.service.getCurrentUser(userId);
      return res.success(user, "Utilisateur récupéré avec succès");
    } catch (error) {
      return res.error(error.message, 404);
    }
  }

  async updateProfile(req, res) {
    try {
      const userId = req.user.id;
      const { prenom, nom, phone } = req.body;
      const avatarFile = req.file;

      const user = await this.service.updateProfile(userId, {
        prenom,
        nom,
        phone,
        avatarFile,
      });

      return res.success(user, "Profil mis à jour avec succès");
    } catch (error) {
      return res.error(error.message, 400);
    }
  }

  async updateCanCreateOrganization(req, res) {
    try {
      const { userId, canCreateOrganization } = req.body;

      if (!userId || typeof canCreateOrganization !== "boolean") {
        return res.error("Paramètres invalides", 400);
      }

      const result = await this.service.updateCanCreateOrganization(
        userId,
        canCreateOrganization
      );

      return res.success(result, result.message);
    } catch (error) {
      return res.error(error.message, 400);
    }
  }

  async refreshToken(req, res) {
    try {
      // ✅ Récupérer le refresh token depuis les cookies
      const refreshToken = CookieManager.getRefreshToken(req);

      if (!refreshToken) {
        return res.error("Refresh token manquant", 401);
      }

      const result = await this.service.refreshAccessToken(refreshToken);

      // ✅ Mettre à jour uniquement l'access token cookie
      CookieManager.setAccessToken(res, result.accessToken);

      return res.success(null, "Token rafraîchi avec succès");
    } catch (error) {
      const statusCode =
        error.message.includes("invalide") ||
        error.message.includes("révoqué") ||
        error.message.includes("expiré")
          ? 401
          : 400;

      // ✅ Supprimer les cookies en cas d'erreur
      CookieManager.clearAuthCookies(res);
      
      return res.error(error.message, statusCode);
    }
  }

  async revokeAllTokens(req, res) {
    try {
      const userId = req.user.id;
      const result = await this.service.revokeAllUserTokens(userId);

      // ✅ Supprimer les cookies après révocation
      CookieManager.clearAuthCookies(res);

      return res.success(result, result.message);
    } catch (error) {
      return res.error(error.message, 400);
    }
  }

  async revokeRefreshToken(req, res) {
    try {
      // ✅ Récupérer le refresh token depuis les cookies
      const refreshToken = CookieManager.getRefreshToken(req);

      if (!refreshToken) {
        return res.error("Refresh token manquant", 400);
      }

      const result = await this.service.revokeRefreshToken(refreshToken);

      // ✅ Supprimer les cookies après révocation
      CookieManager.clearAuthCookies(res);

      return res.success(result, result.message);
    } catch (error) {
      return res.error(error.message, 400);
    }
  }
}