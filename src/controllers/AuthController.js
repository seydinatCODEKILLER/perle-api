import AuthService from "../services/AuthService.js";
import logger from "../config/logger.js";
import AuthSchema from "../schemas/AuthSchema.js";
import { CookieManager } from "../utils/cookie.utils.js";
import { COOKIE_CONFIG } from "../config/cookie.config.js";

export default class AuthController {
  constructor() {
    this.service = new AuthService();
    this.schema = new AuthSchema();
  }

  async register(req, res) {
    try {
      this.schema.validateRegister(req.body);

      const { prenom, nom, email, password, phone, gender } = req.body;
      const avatarFile = req.file;

      const result = await this.service.register({
        prenom,
        nom,
        email,
        password,
        phone,
        gender,
        avatarFile,
      });

      // ✅ Définir les cookies
      CookieManager.setAuthTokens(res, result.accessToken, result.refreshToken);

      // ✅ Ne pas renvoyer les tokens dans le body
      const { accessToken, refreshToken, ...userData } = result;

      return res.success(userData, "Inscription réussie", 201);
    } catch (error) {
      return res.error(error.message, 400);
    }
  }

  async login(req, res) {
    try {
      this.schema.validateLogin(req.body);
      const { phone, password } = req.body;

      const result = await this.service.login(phone, password);

      logger.info("🔐 ==================== LOGIN SUCCESS ====================");
      logger.info(`User: ${result.user.email || result.user.phone}`);
      logger.info(
        `Setting cookies with config: secure=${COOKIE_CONFIG.ACCESS_TOKEN.secure}, sameSite=${COOKIE_CONFIG.ACCESS_TOKEN.sameSite}`,
      );

      CookieManager.setAuthTokens(res, result.accessToken, result.refreshToken);

      logger.info("✅ Cookies set in response headers");

      const { accessToken, refreshToken, ...userData } = result;

      return res.success(userData, "Connexion réussie");
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

      // ✅ Supprimer les cookies
      CookieManager.clearAuthCookies(res);

      return res.success(null, "Déconnexion réussie");
    } catch (error) {
      // ✅ Toujours supprimer les cookies même en cas d'erreur
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
      const { prenom, nom, phone, gender } = req.body;
      const avatarFile = req.file;

      const user = await this.service.updateProfile(userId, {
        prenom,
        nom,
        phone,
        gender,
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
        canCreateOrganization,
      );

      return res.success(result, result.message);
    } catch (error) {
      return res.error(error.message, 400);
    }
  }

  async refreshToken(req, res) {
    try {
      logger.info(
        "🔄 ==================== REFRESH TOKEN REQUEST ====================",
      );
      logger.info(
        `Headers: ${JSON.stringify({
          origin: req.headers.origin,
          cookie: req.headers.cookie,
        })}`,
      );
      logger.info(`Parsed Cookies: ${JSON.stringify(req.cookies)}`);

      const refreshToken = CookieManager.getRefreshToken(req);

      logger.info(`Refresh Token Found: ${!!refreshToken}`);

      if (!refreshToken) {
        logger.error("❌ REFRESH TOKEN MANQUANT !");
        logger.error(`Available cookies: ${Object.keys(req.cookies || {})}`);
        return res.error("Refresh token requis", 400);
      }

      logger.info("✅ Refresh token trouvé, calling service...");

      const result = await this.service.refreshAccessToken(refreshToken);

      logger.info(
        `✅ Service returned new access token for user: ${result.user.id}`,
      );

      CookieManager.setAccessToken(res, result.accessToken);

      logger.info("✅ New access token cookie set");

      return res.success({ user: result.user }, "Token rafraîchi avec succès");
    } catch (error) {
      logger.error(`❌ ERREUR REFRESH TOKEN: ${error.message}`);

      CookieManager.clearAuthCookies(res);

      const statusCode =
        error.message.includes("invalide") ||
        error.message.includes("révoqué") ||
        error.message.includes("expiré")
          ? 401
          : 400;
      return res.error(error.message, statusCode);
    }
  }

  async revokeAllTokens(req, res) {
    try {
      const userId = req.user.id;
      const result = await this.service.revokeAllUserTokens(userId);

      // ✅ Supprimer les cookies
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
        return res.error("Refresh token requis", 400);
      }

      const result = await this.service.revokeRefreshToken(refreshToken);

      // ✅ Supprimer les cookies
      CookieManager.clearAuthCookies(res);

      return res.success(result, result.message);
    } catch (error) {
      return res.error(error.message, 400);
    }
  }
}
