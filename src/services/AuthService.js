import { v4 as uuidv4 } from "uuid";
import PasswordHasher from "../utils/hash.js";
import TokenGenerator from "../config/jwt.js";
import MediaUploader from "../utils/uploadMedia.js";
import { prisma } from "../config/database.js";
import EmailService from "../utils/EmailService.js";

export default class AuthService {
  constructor() {
    this.passwordHasher = new PasswordHasher();
    this.tokenGenerator = new TokenGenerator();
    this.mediaUploader = new MediaUploader();
    this.emailService = new EmailService();
  }

  async register(userData) {
    const { prenom, nom, email, password, phone, avatarFile } = userData;

    // Vérification si l'email existe déjà
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error("Un utilisateur avec cet email existe déjà");
    }

    let avatarUrl = null;

    try {
      // Upload de l'avatar si fourni
      if (avatarFile) {
        avatarUrl = await this.mediaUploader.upload(
          avatarFile,
          "organizations/avatars",
          `user_${prenom}_${nom}`.toLowerCase()
        );
      }

      // Hash du mot de passe
      const hashedPassword = await this.passwordHasher.hash(password);

      // Création de l'utilisateur
      const user = await prisma.user.create({
        data: {
          prenom,
          nom,
          email,
          password: hashedPassword,
          phone,
          avatar: avatarUrl,
        },
        select: {
          id: true,
          prenom: true,
          nom: true,
          email: true,
          phone: true,
          role: true,
          avatar: true,
          isActive: true,
          canCreateOrganization: true,
          createdAt: true,
          lastLoginAt: true,
        },
      });

      // Génération du token JWT
      const token = this.tokenGenerator.sign({
        id: user.id,
        email: user.email,
        role: user.role,
        canCreateOrganization: user.canCreateOrganization,
      });

      // Mise à jour de la dernière connexion
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      return {
        user,
        token,
      };
    } catch (error) {
      // Rollback de l'upload si erreur
      if (avatarUrl) {
        await this.mediaUploader.rollback(
          `user_${prenom}_${nom}`.toLowerCase()
        );
      }
      throw error;
    }
  }

  async login(phone, password) {
    // Chercher l'utilisateur par téléphone
    const user = await prisma.user.findUnique({
      where: { phone },
    });

    if (!user) throw new Error("Numéro de téléphone ou mot de passe incorrect");
    if (!user.isActive) throw new Error("Compte utilisateur inactif");

    // Vérifier si le mot de passe est défini
    if (!user.password) {
      throw new Error(
        "Aucun mot de passe défini. Veuillez réinitialiser votre mot de passe."
      );
    }

    const isPasswordValid = await this.passwordHasher.compare(
      password,
      user.password
    );

    if (!isPasswordValid)
      throw new Error("Numéro de téléphone ou mot de passe incorrect");

    // Mise à jour de la dernière connexion
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Génération du token
    const token = this.tokenGenerator.sign({
      id: user.id,
      phone: user.phone,
      email: user.email,
      role: user.role,
      canCreateOrganization: user.canCreateOrganization,
    });

    // Données utilisateur sans le mot de passe
    const userData = {
      id: user.id,
      prenom: user.prenom,
      nom: user.nom,
      email: user.email,
      phone: user.phone,
      role: user.role,
      avatar: user.avatar,
      isActive: user.isActive,
      canCreateOrganization: user.canCreateOrganization,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };

    return {
      user: userData,
      token,
    };
  }

  async sendLoginCode(email) {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Pour des raisons de sécurité, on ne révèle pas si l'email existe
    if (!user) {
      return {
        message: "Si l'email existe, un code de connexion a été envoyé",
      };
    }

    if (!user.isActive) {
      throw new Error("Compte utilisateur inactif");
    }

    // Génération d'un code à 6 chiffres
    const loginCode = Math.floor(100000 + Math.random() * 900000).toString();
    const loginCodeExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Mise à jour de l'utilisateur avec le code
    await prisma.user.update({
      where: { id: user.id },
      data: {
        loginCode,
        loginCodeExpiresAt,
      },
    });

    // Envoi du code par email
    await this.emailService.sendLoginCodeEmail(
      email,
      loginCode,
      user.firstName
    );

    return {
      message: "Si l'email existe, un code de connexion a été envoyé",
    };
  }

  async verifyLoginCode(email, loginCode) {
    const user = await prisma.user.findUnique({
      where: {
        email,
        loginCode,
        loginCodeExpiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      throw new Error("Code invalide ou expiré");
    }

    if (!user.isActive) {
      throw new Error("Compte utilisateur inactif");
    }

    // Réinitialiser le code après utilisation
    await prisma.user.update({
      where: { id: user.id },
      data: {
        loginCode: null,
        loginCodeExpiresAt: null,
        lastLoginAt: new Date(),
      },
    });

    const token = this.tokenGenerator.sign({
      id: user.id,
      email: user.email,
      role: user.role,
      canCreateOrganization: user.canCreateOrganization,
    });

    const userData = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      avatar: user.avatar,
      isActive: user.isActive,
      canCreateOrganization: user.canCreateOrganization,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };

    return {
      user: userData,
      token,
    };
  }

  async forgotPassword(email) {
    // Recherche de l'utilisateur
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Pour des raisons de sécurité, on ne révèle pas si l'email existe
    if (!user) {
      return {
        message: "Si l'email existe, un lien de réinitialisation a été envoyé",
      };
    }

    if (!user.isActive) {
      throw new Error("Compte utilisateur inactif");
    }

    // Génération d'un token unique
    const resetToken = uuidv4();
    const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 heure

    // Création ou mise à jour du token de réinitialisation
    await prisma.passwordResetToken.upsert({
      where: { email },
      update: {
        token: resetToken,
        expiresAt,
        status: "PENDING",
        updatedAt: new Date(),
      },
      create: {
        email,
        token: resetToken,
        expiresAt,
        userId: user.id,
      },
    });

    // Envoi de l'email
    await this.emailService.sendPasswordResetEmail(email, resetToken);

    return {
      message: "Si l'email existe, un lien de réinitialisation a été envoyé",
    };
  }

  async resetPassword(token, newPassword) {
    // Recherche du token valide
    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        token,
        status: "PENDING",
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: true,
      },
    });

    if (!resetToken) {
      throw new Error("Token invalide ou expiré");
    }

    // Hash du nouveau mot de passe
    const hashedPassword = await this.passwordHasher.hash(newPassword);

    // Transaction pour garantir la cohérence des données
    const result = await prisma.$transaction(async (tx) => {
      // Mise à jour du mot de passe utilisateur
      const user = await tx.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      });

      // Marquer le token comme utilisé
      await tx.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { status: "USED" },
      });

      return user;
    });

    // Envoi de l'email de confirmation
    this.emailService
      .sendPasswordChangedEmail(
        result.email,
        `${result.firstName} ${result.lastName}`
      )
      .catch((error) =>
        console.error("❌ Erreur email de confirmation:", error)
      );

    return {
      message: "Mot de passe réinitialisé avec succès",
      user: result,
    };
  }

  async getCurrentUser(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        avatar: true,
        isActive: true,
        canCreateOrganization: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        memberships: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                type: true,
                logo: true,
                currency: true,
              },
            },
            profile: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error("Utilisateur non trouvé");
    }

    return user;
  }

  async updateProfile(userId, updateData) {
    const { firstName, lastName, phone, avatarFile } = updateData;

    let newAvatarInfo;

    try {
      // Récupérer l'ancien utilisateur
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error("Utilisateur non trouvé");

      const oldAvatarUrl = user.avatar;

      // Upload du nouvel avatar si fourni
      if (avatarFile) {
        const timestamp = Date.now();
        const prefix = `user_${userId}_${timestamp}`;
        const uploadedUrl = await this.mediaUploader.upload(
          avatarFile,
          "organizations/avatars",
          prefix
        );

        newAvatarInfo = { url: uploadedUrl, prefix };
      }

      // Mise à jour du profil
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(firstName && { firstName }),
          ...(lastName && { lastName }),
          ...(phone && { phone }),
          ...(newAvatarInfo && { avatar: newAvatarInfo.url }),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          avatar: true,
          isActive: true,
          canCreateOrganization: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
        },
      });

      // Supprimer l'ancien avatar si nouveau upload réussi
      if (newAvatarInfo && oldAvatarUrl) {
        await this.mediaUploader.deleteByUrl(oldAvatarUrl);
      }

      return updatedUser;
    } catch (error) {
      // Rollback si nouvel upload échoue
      if (newAvatarInfo) {
        await this.mediaUploader.rollback(newAvatarInfo.prefix);
      }
      throw error;
    }
  }

  async updateCanCreateOrganization(userId, canCreateOrganization) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("Utilisateur non trouvé");
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { canCreateOrganization },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        avatar: true,
        isActive: true,
        canCreateOrganization: true,
        createdAt: true,
      },
    });

    return {
      message: `Droit de création d'organisation ${
        canCreateOrganization ? "activé" : "désactivé"
      } pour cet utilisateur`,
      user: updatedUser,
    };
  }

  async logout() {
    // Pour JWT stateless, on ne fait rien côté serveur
    // Le token sera invalidé côté client
    return { message: "Déconnexion réussie" };
  }
}
