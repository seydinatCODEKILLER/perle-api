import PasswordHasher from "../utils/hash.js";
import TokenGenerator from "../config/jwt.js";
import MediaUploader from "../utils/uploadMedia.js";
import { prisma } from "../config/database.js";
import crypto from "crypto";

export default class AuthService {
  constructor() {
    this.passwordHasher = new PasswordHasher();
    this.tokenGenerator = new TokenGenerator();
    this.mediaUploader = new MediaUploader();
  }

  async register(userData) {
    const { prenom, nom, email, password, phone, gender, avatarFile } =
      userData;

    let avatarUrl = null;
    let avatarPrefix = null;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error("Un utilisateur avec cet email existe déjà");
    }

    const existUserWithPhone = await prisma.user.findUnique({
      where: { phone },
    });

    if (existUserWithPhone) {
      throw new Error("Un utilisateur avec ce numero existe deja");
    }

    try {
      if (avatarFile) {
        const timestamp = Date.now();
        avatarPrefix = `user_${prenom}_${nom}_${timestamp}`;

        avatarUrl = await this.mediaUploader.upload(
          avatarFile,
          "organizations/avatars",
          avatarPrefix,
        );
      }

      const hashedPassword = await this.passwordHasher.hash(password);

      const user = await prisma.user.create({
        data: {
          prenom,
          nom,
          email,
          password: hashedPassword,
          phone,
          gender: gender ?? null,
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
          gender: true,
          isActive: true,
          canCreateOrganization: true,
          createdAt: true,
          lastLoginAt: true,
        },
      });

      const { accessToken, refreshToken } = await this.generateTokens(user);

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      return {
        user,
        accessToken,
        refreshToken,
      };
    } catch (error) {
      if (avatarUrl) {
        await this.mediaUploader.rollback(avatarUrl);
      }
      throw error;
    }
  }

  async login(phone, password) {
    const user = await prisma.user.findUnique({
      where: { phone },
    });

    if (!user) throw new Error("Numéro de téléphone ou mot de passe incorrect");
    if (!user.isActive) throw new Error("Compte utilisateur inactif");

    if (!user.password) {
      throw new Error(
        "Aucun mot de passe défini. Veuillez réinitialiser votre mot de passe.",
      );
    }

    const isPasswordValid = await this.passwordHasher.compare(
      password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new Error("Numéro de téléphone ou mot de passe incorrect");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Génération des tokens
    const { accessToken, refreshToken } = await this.generateTokens(user);

    const userData = {
      id: user.id,
      prenom: user.prenom,
      nom: user.nom,
      email: user.email,
      phone: user.phone,
      role: user.role,
      gender: user.gender,
      avatar: user.avatar,
      isActive: user.isActive,
      canCreateOrganization: user.canCreateOrganization,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };

    return {
      user: userData,
      accessToken,
      refreshToken,
    };
  }

  async getCurrentUser(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        prenom: true,
        nom: true,
        email: true,
        phone: true,
        role: true,
        gender: true,
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
    const { prenom, nom, phone, gender, avatarFile } = updateData;

    let newAvatarInfo;

    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error("Utilisateur non trouvé");

      const oldAvatarUrl = user.avatar;

      if (avatarFile) {
        const timestamp = Date.now();
        const prefix = `user_${userId}_${timestamp}`;
        const uploadedUrl = await this.mediaUploader.upload(
          avatarFile,
          "organizations/avatars",
          prefix,
        );

        newAvatarInfo = { url: uploadedUrl, prefix };
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(prenom && { prenom }),
          ...(nom && { nom }),
          ...(phone && { phone }),
          ...(gender && { gender }),
          ...(newAvatarInfo && { avatar: newAvatarInfo.url }),
        },
        select: {
          id: true,
          prenom: true,
          nom: true,
          email: true,
          phone: true,
          role: true,
          avatar: true,
          gender: true,
          isActive: true,
          canCreateOrganization: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
        },
      });

      if (newAvatarInfo && oldAvatarUrl) {
        await this.mediaUploader.deleteByUrl(oldAvatarUrl);
      }

      return updatedUser;
    } catch (error) {
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
        prenom: true,
        nom: true,
        email: true,
        role: true,
        avatar: true,
        gender: true,
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

  /**
   * Déconnexion - révoque le refresh token fourni
   */
  async logout(refreshToken) {
    if (refreshToken) {
      await this.revokeRefreshToken(refreshToken);
    }
    return { message: "Déconnexion réussie" };
  }

  /**
   * Génère et stocke un refresh token
   */
  async generateRefreshToken(userId) {
    const refreshToken = crypto.randomBytes(64).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        expiresAt,
      },
    });

    return refreshToken;
  }

  /**
   * Génère les tokens (access + refresh)
   */
  async generateTokens(user) {
    const accessToken = this.tokenGenerator.sign({
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      gender: user.gender,
      canCreateOrganization: user.canCreateOrganization,
    });

    const refreshToken = await this.generateRefreshToken(user.id);

    return { accessToken, refreshToken };
  }

  /**
   * Rafraîchit l'access token avec un refresh token
   */
  async refreshAccessToken(refreshToken) {
    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!tokenRecord) {
      throw new Error("Refresh token invalide");
    }

    if (tokenRecord.isRevoked) {
      throw new Error("Refresh token révoqué");
    }

    if (new Date() > tokenRecord.expiresAt) {
      throw new Error("Refresh token expiré");
    }

    if (!tokenRecord.user.isActive) {
      throw new Error("Compte utilisateur inactif");
    }

    // Générer un nouvel access token
    const accessToken = this.tokenGenerator.sign({
      id: tokenRecord.user.id,
      email: tokenRecord.user.email,
      phone: tokenRecord.user.phone,
      role: tokenRecord.user.role,
      gender: tokenRecord.gender,
      canCreateOrganization: tokenRecord.user.canCreateOrganization,
    });

    return { accessToken };
  }

  /**
   * Révoque un refresh token
   */
  async revokeRefreshToken(refreshToken) {
    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!tokenRecord) {
      throw new Error("Refresh token introuvable");
    }

    await prisma.refreshToken.update({
      where: { token: refreshToken },
      data: { isRevoked: true },
    });

    return { message: "Refresh token révoqué avec succès" };
  }

  /**
   * Révoque tous les refresh tokens d'un utilisateur
   */
  async revokeAllUserTokens(userId) {
    await prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });

    return { message: "Tous les refresh tokens ont été révoqués" };
  }

  /**
   * Nettoie les refresh tokens expirés
   */
  async cleanupExpiredTokens() {
    const result = await prisma.refreshToken.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: new Date() } }, { isRevoked: true }],
      },
    });

    return { deletedCount: result.count };
  }
}
