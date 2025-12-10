// controllers/AuthController.js
import AuthService from "../services/AuthService.js";
import AuthSchema from "../schemas/AuthSchema.js";

export default class AuthController {
  constructor() {
    this.service = new AuthService();
    this.schema = new AuthSchema();
  }

  async register(req, res) {
    try {
      // Validation des données
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

      return res.success(result, "Inscription réussie", 201);
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

      return res.success(result, "Connexion réussie");
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
      const result = await this.service.logout();
      return res.success(result, "Déconnexion réussie");
    } catch (error) {
      return res.error("Erreur lors de la déconnexion", 500);
    }
  }

  async forgotPassword(req, res) {
    try {
      // Validation des données
      this.schema.validateForgotPassword(req.body);

      const { email } = req.body;

      const result = await this.service.forgotPassword(email);

      return res.success(null, result.message);
    } catch (error) {
      return res.error(error.message, 400);
    }
  }

  async resetPassword(req, res) {
    try {
      // Validation des données
      this.schema.validateResetPassword(req.body);

      const { token, newPassword } = req.body;

      const result = await this.service.resetPassword(token, newPassword);

      return res.success({ user: result.user }, result.message);
    } catch (error) {
      return res.error(error.message, 400);
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
      const { firstName, lastName, phone } = req.body;
      const avatarFile = req.file;

      const user = await this.service.updateProfile(userId, {
        firstName,
        lastName,
        phone,
        avatarFile,
      });

      return res.success(user, "Profil mis à jour avec succès");
    } catch (error) {
      return res.error(error.message, 400);
    }
  }

  async sendLoginCode(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.error("L'email est requis", 400);
      }

      const result = await this.service.sendLoginCode(email);

      return res.success(null, result.message);
    } catch (error) {
      return res.error(error.message, 400);
    }
  }

  async verifyLoginCode(req, res) {
    try {
      const { email, loginCode } = req.body;

      if (!email || !loginCode) {
        return res.error("L'email et le code sont requis", 400);
      }

      const result = await this.service.verifyLoginCode(email, loginCode);

      return res.success(result, "Connexion réussie avec code");
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
}
