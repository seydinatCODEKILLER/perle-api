// services/AuthService.js

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

  /**
   * ✅ Inscription avec synchronisation automatique des membres provisoires
   */
  async register(userData) {
    const { prenom, nom, email, password, phone, gender, avatarFile } =
      userData;

    let avatarUrl = null;
    let avatarPrefix = null;

    // Vérifier si l'email existe déjà
    if (email) {
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        throw new Error("Un utilisateur avec cet email existe déjà");
      }
    }

    // Vérifier si le téléphone existe déjà
    const existUserWithPhone = await prisma.user.findUnique({
      where: { phone },
    });

    if (existUserWithPhone) {
      throw new Error("Un utilisateur avec ce numero existe deja");
    }

    try {
      // Upload de l'avatar si fourni
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

      // Créer l'utilisateur
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

      // ✅ NOUVEAU: Synchroniser les membres provisoires avec ce téléphone
      const linkedMemberships = await this.#linkProvisionalMembers(
        phone,
        user.id,
      );

      // Générer les tokens
      const { accessToken, refreshToken } = await this.generateTokens(user);

      // Mettre à jour la date de dernière connexion
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      return {
        user,
        accessToken,
        refreshToken,
        linkedMemberships, // ✅ Retourner les memberships liés
      };
    } catch (error) {
      // Rollback de l'avatar en cas d'erreur
      if (avatarUrl) {
        await this.mediaUploader.rollback(avatarUrl);
      }
      throw error;
    }
  }

  /**
   * ✅ NOUVEAU: Lier les membres provisoires au nouveau compte utilisateur
   * @private
   */
  async #linkProvisionalMembers(phone, userId) {
    try {
      // Trouver tous les memberships provisoires avec ce téléphone
      const provisionalMemberships = await prisma.membership.findMany({
        where: {
          provisionalPhone: phone,
          userId: null, // Seulement les membres sans compte
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              type: true,
              logo: true,
            },
          },
        },
      });

      if (provisionalMemberships.length === 0) {
        return {
          linked: 0,
          memberships: [],
        };
      }

      // Lier chaque membership au compte utilisateur
      const updatedMemberships = await Promise.all(
        provisionalMemberships.map(async (membership) => {
          const updated = await prisma.membership.update({
            where: { id: membership.id },
            data: {
              userId, // Lier le compte
              // Les données provisoires sont conservées pour l'historique
              // Mais User devient la source de vérité principale
            },
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
          });

          // Créer un log d'audit pour tracer la synchronisation
          await prisma.auditLog.create({
            data: {
              action: "LINK_PROVISIONAL_MEMBER",
              resource: "membership",
              resourceId: membership.id,
              userId,
              organizationId: membership.organizationId,
              membershipId: membership.id,
              details: JSON.stringify({
                phone,
                linkedAt: new Date().toISOString(),
                previousProvisionalData: {
                  firstName: membership.provisionalFirstName,
                  lastName: membership.provisionalLastName,
                  email: membership.provisionalEmail,
                },
                newUserData: {
                  userId,
                },
              }),
            },
          });

          return updated;
        }),
      );

      return {
        linked: updatedMemberships.length,
        memberships: updatedMemberships.map((m) => ({
          id: m.id,
          organizationId: m.organizationId,
          organizationName: m.organization.name,
          organizationType: m.organization.type,
          role: m.role,
          memberNumber: m.memberNumber,
          joinDate: m.joinDate,
        })),
      };
    } catch (error) {
      console.error(
        "Erreur lors de la synchronisation des membres provisoires:",
        error,
      );
      // On ne bloque pas l'inscription même si le lien échoue
      // L'admin pourra le faire manuellement si nécessaire
      return {
        linked: 0,
        memberships: [],
        error: error.message,
      };
    }
  }

  /**
   * Connexion
   */
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

  /**
   * Obtenir l'utilisateur connecté
   */
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
          where: {
            status: "ACTIVE", // ✅ Ne récupérer que les memberships actifs
          },
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

  /**
   * Mettre à jour le profil
   */
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

  /**
   * Mettre à jour le droit de création d'organisation
   */
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

  // services/AuthService.js

  /**
   * Rafraîchit l'access token avec un refresh token
   */
  async refreshAccessToken(refreshToken) {
    console.log("🔄 refreshAccessToken called");

    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    console.log("🔍 Token record found:", {
      exists: !!tokenRecord,
      hasUser: !!tokenRecord?.user,
      userId: tokenRecord?.user?.id,
    });

    if (!tokenRecord) {
      console.error("❌ Token not found in database");
      throw new Error("Refresh token invalide");
    }

    if (tokenRecord.isRevoked) {
      console.error("❌ Token is revoked");
      throw new Error("Refresh token révoqué");
    }

    if (new Date() > tokenRecord.expiresAt) {
      console.error("❌ Token expired:", tokenRecord.expiresAt);
      throw new Error("Refresh token expiré");
    }

    if (!tokenRecord.user) {
      console.error("❌ No user found in token record");
      throw new Error("Utilisateur introuvable");
    }

    if (!tokenRecord.user.isActive) {
      console.error("❌ User is inactive");
      throw new Error("Compte utilisateur inactif");
    }

    console.log("✅ User found:", tokenRecord.user.email);

    // Générer un nouvel access token
    const accessToken = this.tokenGenerator.sign({
      id: tokenRecord.user.id,
      email: tokenRecord.user.email,
      phone: tokenRecord.user.phone,
      role: tokenRecord.user.role,
      gender: tokenRecord.user.gender,
      canCreateOrganization: tokenRecord.user.canCreateOrganization,
    });

    console.log("✅ New access token generated");

    // ✅ FIX: Retourner AUSSI le user
    return {
      accessToken,
      user: {
        id: tokenRecord.user.id,
        prenom: tokenRecord.user.prenom,
        nom: tokenRecord.user.nom,
        email: tokenRecord.user.email,
        phone: tokenRecord.user.phone,
        role: tokenRecord.user.role,
        gender: tokenRecord.user.gender,
        avatar: tokenRecord.user.avatar,
        isActive: tokenRecord.user.isActive,
        canCreateOrganization: tokenRecord.user.canCreateOrganization,
        createdAt: tokenRecord.user.createdAt,
        lastLoginAt: tokenRecord.user.lastLoginAt,
      },
    };
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
