// services/MembershipService.js

import { prisma } from "../config/database.js";
import MediaUploader from "../utils/uploadMedia.js";

export default class MembershipService {
  constructor() {
    this.mediaUploader = new MediaUploader();
  }

  /**
   * ✅ Créer un membre avec ou sans compte utilisateur
   */
  async createMembership(organizationId, currentUserId, membershipData) {
    const currentMembership = await prisma.membership.findFirst({
      where: {
        userId: currentUserId,
        organizationId,
        status: "ACTIVE",
        role: { in: ["ADMIN", "FINANCIAL_MANAGER"] },
      },
    });

    if (!currentMembership) {
      throw new Error("Permissions insuffisantes pour ajouter un membre");
    }

    await this.#checkSubscriptionLimits(organizationId);

    const { phone, provisionalData, avatarFile, memberType } = membershipData;

    // ✅ CAS 1: Membre avec compte existant
    if (memberType === "existing" && phone) {
      const user = await prisma.user.findUnique({
        where: { phone },
      });

      if (!user) {
        throw new Error("Aucun utilisateur trouvé avec ce numéro de téléphone");
      }

      // Vérifier si déjà membre
      const existingMembership = await prisma.membership.findFirst({
        where: {
          userId: user.id,
          organizationId,
        },
      });

      if (existingMembership) {
        throw new Error(
          "Cet utilisateur est déjà membre de cette organisation",
        );
      }

      return await this.#createMembershipWithUser(
        organizationId,
        currentUserId,
        currentMembership.id,
        user,
        membershipData,
      );
    }

    // ✅ CAS 2: Membre provisoire
    if (memberType === "provisional" && provisionalData) {
      if (!provisionalData.firstName || !provisionalData.lastName) {
        throw new Error("Le nom et le prénom sont requis");
      }

      if (!provisionalData.phone) {
        throw new Error("Le numéro de téléphone est requis");
      }

      // Vérifier que le téléphone n'est pas déjà utilisé
      const [existingUser, existingProvisional] = await Promise.all([
        prisma.user.findUnique({
          where: { phone: provisionalData.phone },
        }),
        prisma.membership.findFirst({
          where: {
            organizationId,
            provisionalPhone: provisionalData.phone,
            userId: null,
          },
        }),
      ]);

      if (existingUser) {
        throw new Error(
          "Ce numéro de téléphone est déjà associé à un compte utilisateur",
        );
      }

      if (existingProvisional) {
        throw new Error(
          "Ce numéro de téléphone est déjà utilisé par un membre provisoire de cette organisation",
        );
      }

      return await this.#createProvisionalMembership(
        organizationId,
        currentUserId,
        currentMembership.id,
        provisionalData,
        membershipData,
        avatarFile,
      );
    }

    // ✅ Cas invalide
    throw new Error(
      "Données invalides. Veuillez spécifier le type de membre (existing ou provisional).",
    );
  }

  /**
   * ✅ Créer un membership avec utilisateur existant
   */
  async #createMembershipWithUser(
    organizationId,
    currentUserId,
    currentMembershipId,
    user,
    membershipData,
  ) {
    const membership = await prisma.membership.create({
      data: {
        userId: user.id,
        organizationId,
        role: membershipData.role || "MEMBER",
        memberNumber: await this.#generateMemberNumber(organizationId),
        loginId: this.#generateLoginId(),
      },
      include: {
        user: {
          select: {
            id: true,
            prenom: true,
            nom: true,
            email: true,
            phone: true,
            avatar: true,
            gender: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    await this.#updateSubscriptionUsage(organizationId, 1);

    await prisma.auditLog.create({
      data: {
        action: "CREATE_MEMBERSHIP",
        resource: "membership",
        resourceId: membership.id,
        userId: currentUserId,
        organizationId,
        membershipId: currentMembershipId,
        details: JSON.stringify({
          userId: membership.userId,
          role: membership.role,
          memberNumber: membership.memberNumber,
          type: "with_account",
        }),
      },
    });

    return membership;
  }

  /**
   * ✅ Créer un membership provisoire (sans compte)
   */
  async #createProvisionalMembership(
    organizationId,
    currentUserId,
    currentMembershipId,
    provisionalData,
    membershipData,
    avatarFile,
  ) {
    let avatarUrl = null;
    let avatarPrefix = null;

    try {
      // ✅ Upload de l'avatar si présent
      if (avatarFile) {
        const timestamp = Date.now();
        avatarPrefix = `member_${organizationId}_${provisionalData.phone}_${timestamp}`;

        avatarUrl = await this.mediaUploader.upload(
          avatarFile,
          "organizations/members/avatars",
          avatarPrefix,
        );
      }

      const membership = await prisma.membership.create({
        data: {
          userId: null,
          organizationId,
          role: membershipData.role || "MEMBER",
          memberNumber: await this.#generateMemberNumber(organizationId),
          loginId: this.#generateLoginId(),
          provisionalFirstName: provisionalData.firstName,
          provisionalLastName: provisionalData.lastName,
          provisionalPhone: provisionalData.phone,
          provisionalEmail: provisionalData.email || null,
          provisionalAvatar: avatarUrl,
          provisionalGender: provisionalData.gender || null,
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      await this.#updateSubscriptionUsage(organizationId, 1);

      await prisma.auditLog.create({
        data: {
          action: "CREATE_MEMBERSHIP",
          resource: "membership",
          resourceId: membership.id,
          userId: currentUserId,
          organizationId,
          membershipId: currentMembershipId,
          details: JSON.stringify({
            role: membership.role,
            memberNumber: membership.memberNumber,
            type: "provisional",
            phone: membership.provisionalPhone,
            hasAvatar: !!avatarUrl,
          }),
        },
      });

      return membership;
    } catch (error) {
      // ✅ Rollback de l'avatar en cas d'erreur
      if (avatarUrl && avatarPrefix) {
        await this.mediaUploader.rollback(avatarPrefix);
      }
      throw error;
    }
  }

  /**
   * ✅ Obtenir les informations d'affichage d'un membre (provisoire ou non)
   */
  getMemberDisplayInfo(membership) {
    if (membership.userId && membership.user) {
      // Membre avec compte - source de vérité = User
      return {
        id: membership.id,
        firstName: membership.user.prenom,
        lastName: membership.user.nom,
        email: membership.user.email,
        phone: membership.user.phone,
        avatar: membership.user.avatar,
        gender: membership.user.gender,
        hasAccount: true,
        isProvisional: false,
      };
    }

    // Membre provisoire - source de vérité = Membership
    return {
      id: membership.id,
      firstName: membership.provisionalFirstName,
      lastName: membership.provisionalLastName,
      email: membership.provisionalEmail,
      phone: membership.provisionalPhone,
      avatar: membership.provisionalAvatar,
      gender: membership.provisionalGender,
      hasAccount: false,
      isProvisional: true,
    };
  }

  /**
   * Obtenir un membre par ID
   */
  async getMembershipById(organizationId, membershipId, currentUserId) {
    // Vérifier que l'utilisateur a accès à cette organisation
    const currentMembership = await prisma.membership.findFirst({
      where: {
        userId: currentUserId,
        organizationId,
        status: "ACTIVE",
      },
    });

    if (!currentMembership) {
      throw new Error("Accès non autorisé à cette organisation");
    }

    const membership = await prisma.membership.findUnique({
      where: {
        id: membershipId,
      },
      include: {
        user: {
          select: {
            id: true,
            prenom: true,
            nom: true,
            email: true,
            phone: true,
            avatar: true,
            gender: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        profile: true,
        _count: {
          select: {
            contributions: true,
            debts: true,
            transactions: true,
          },
        },
      },
    });

    if (!membership) {
      throw new Error("Membre non trouvé");
    }

    // Vérifier que le membre appartient bien à l'organisation
    if (membership.organizationId !== organizationId) {
      throw new Error("Ce membre n'appartient pas à cette organisation");
    }

    // Enrichir avec displayInfo
    return {
      ...membership,
      displayInfo: this.getMemberDisplayInfo(membership),
    };
  }

  /**
   * ✅ Récupérer les membres avec les bonnes données d'affichage
   */
  async getOrganizationMembers(organizationId, currentUserId, filters = {}) {
    const { status, role, search, page = 1, limit = 10 } = filters;
    const skip = (page - 1) * limit;

    // Vérifier que l'utilisateur a accès à cette organisation
    const currentMembership = await prisma.membership.findFirst({
      where: {
        userId: currentUserId,
        organizationId,
        status: "ACTIVE",
      },
    });

    if (!currentMembership) {
      throw new Error("Accès non autorisé à cette organisation");
    }

    const whereClause = {
      organizationId,
      ...(status && { status }),
      ...(role && { role }),
      ...(search && {
        OR: [
          { memberNumber: { contains: search, mode: "insensitive" } },
          // Recherche dans les données User
          {
            user: {
              OR: [
                { prenom: { contains: search, mode: "insensitive" } },
                { nom: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } },
              ],
            },
          },
          // Recherche dans les données provisoires
          { provisionalFirstName: { contains: search, mode: "insensitive" } },
          { provisionalLastName: { contains: search, mode: "insensitive" } },
          { provisionalPhone: { contains: search, mode: "insensitive" } },
          { provisionalEmail: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [memberships, total] = await Promise.all([
      prisma.membership.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              prenom: true,
              nom: true,
              email: true,
              phone: true,
              avatar: true,
              gender: true,
            },
          },
          profile: true,
          _count: {
            select: {
              contributions: true,
              debts: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.membership.count({ where: whereClause }),
    ]);

    // ✅ Enrichir chaque membership avec les bonnes données d'affichage
    const enrichedMembers = memberships.map((membership) => ({
      ...membership,
      displayInfo: this.getMemberDisplayInfo(membership),
    }));

    return {
      members: enrichedMembers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * ✅ Mettre à jour un membre provisoire
   */
  async updateProvisionalMember(
    organizationId,
    membershipId,
    currentUserId,
    updateData,
  ) {
    const currentMembership = await prisma.membership.findFirst({
      where: {
        userId: currentUserId,
        organizationId,
        status: "ACTIVE",
        role: { in: ["ADMIN", "FINANCIAL_MANAGER", "PRESIDENT", "VICE_PRESIDENT", "SECRETARY_GENERAL", "ORGANIZER"] },
      },
    });

    if (!currentMembership) {
      throw new Error("Permissions insuffisantes");
    }

    const membership = await prisma.membership.findUnique({
      where: { id: membershipId },
    });

    if (!membership || membership.organizationId !== organizationId) {
      throw new Error("Membre non trouvé");
    }

    // On ne peut mettre à jour que les membres provisoires
    if (membership.userId !== null) {
      throw new Error(
        "Ce membre a un compte utilisateur. Modifiez son profil utilisateur.",
      );
    }

    const updated = await prisma.membership.update({
      where: { id: membershipId },
      data: {
        ...(updateData.firstName && {
          provisionalFirstName: updateData.firstName,
        }),
        ...(updateData.lastName && {
          provisionalLastName: updateData.lastName,
        }),
        ...(updateData.email !== undefined && {
          provisionalEmail: updateData.email,
        }),
        ...(updateData.phone && { provisionalPhone: updateData.phone }),
        ...(updateData.avatar !== undefined && {
          provisionalAvatar: updateData.avatar,
        }),
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE_PROVISIONAL_MEMBER",
        resource: "membership",
        resourceId: membershipId,
        userId: currentUserId,
        organizationId,
        membershipId: currentMembership.id,
        details: JSON.stringify(updateData),
      },
    });

    return updated;
  }

  /**
   * Mettre à jour un membership (rôle uniquement pour compatibilité)
   */
  async updateMembership(
    organizationId,
    membershipId,
    currentUserId,
    updateData,
  ) {
    // Vérifier les permissions (ADMIN seulement)
    const currentMembership = await prisma.membership.findFirst({
      where: {
        userId: currentUserId,
        organizationId,
        status: "ACTIVE",
        role: "ADMIN",
      },
    });

    if (!currentMembership) {
      throw new Error("Permissions insuffisantes pour modifier un membre");
    }

    // Vérifier l'existence du membership
    const existingMembership = await prisma.membership.findUnique({
      where: { id: membershipId },
    });

    if (
      !existingMembership ||
      existingMembership.organizationId !== organizationId
    ) {
      throw new Error("Membre non trouvé dans cette organisation");
    }

    const updatedMembership = await prisma.membership.update({
      where: { id: membershipId },
      data: {
        role: updateData.role,
      },
      include: {
        user: {
          select: {
            id: true,
            prenom: true,
            nom: true,
            email: true,
            phone: true,
            avatar: true,
            gender: true,
          },
        },
      },
    });

    // Créer un log d'audit
    await prisma.auditLog.create({
      data: {
        action: "UPDATE_MEMBERSHIP",
        resource: "membership",
        resourceId: membershipId,
        userId: currentUserId,
        organizationId,
        membershipId: currentMembership.id,
        details: JSON.stringify(updateData),
      },
    });

    return updatedMembership;
  }

  /**
   * Mettre à jour le statut d'un membership
   */
  async updateMembershipStatus(
    organizationId,
    membershipId,
    currentUserId,
    status,
  ) {
    // Vérifier les permissions (ADMIN seulement)
    const currentMembership = await prisma.membership.findFirst({
      where: {
        userId: currentUserId,
        organizationId,
        status: "ACTIVE",
        role: "ADMIN",
      },
    });

    if (!currentMembership) {
      throw new Error(
        "Permissions insuffisantes pour modifier le statut d'un membre",
      );
    }

    // Vérifier l'existence du membership
    const existingMembership = await prisma.membership.findUnique({
      where: { id: membershipId },
    });

    if (
      !existingMembership ||
      existingMembership.organizationId !== organizationId
    ) {
      throw new Error("Membre non trouvé dans cette organisation");
    }

    const updatedMembership = await prisma.membership.update({
      where: { id: membershipId },
      data: { status },
      include: {
        user: {
          select: {
            id: true,
            prenom: true,
            nom: true,
            email: true,
            phone: true,
            avatar: true,
            gender: true,
          },
        },
      },
    });

    // Créer un log d'audit
    await prisma.auditLog.create({
      data: {
        action: "UPDATE_MEMBERSHIP_STATUS",
        resource: "membership",
        resourceId: membershipId,
        userId: currentUserId,
        organizationId,
        membershipId: currentMembership.id,
        details: JSON.stringify({ status }),
      },
    });

    return updatedMembership;
  }

  /**
   * Mettre à jour le rôle d'un membership
   */
  async updateMembershipRole(
    organizationId,
    membershipId,
    currentUserId,
    role,
  ) {
    // Vérifier les permissions (ADMIN seulement)
    const currentMembership = await prisma.membership.findFirst({
      where: {
        userId: currentUserId,
        organizationId,
        status: "ACTIVE",
        role: "ADMIN",
      },
    });

    if (!currentMembership) {
      throw new Error(
        "Permissions insuffisantes pour modifier le rôle d'un membre",
      );
    }

    if (!role) throw new Error("Le rôle est requis");

    // Vérifier l'existence du membership
    const existingMembership = await prisma.membership.findUnique({
      where: { id: membershipId },
    });

    if (
      !existingMembership ||
      existingMembership.organizationId !== organizationId
    ) {
      throw new Error("Membre non trouvé dans cette organisation");
    }

    // Vérifier qu'on ne peut pas modifier son propre rôle
    if (existingMembership.userId === currentUserId) {
      throw new Error("Vous ne pouvez pas modifier votre propre rôle");
    }

    const updatedMembership = await prisma.membership.update({
      where: { id: membershipId },
      data: { role },
      include: {
        user: {
          select: {
            id: true,
            prenom: true,
            nom: true,
            email: true,
            phone: true,
            avatar: true,
            gender: true,
          },
        },
      },
    });

    // Créer un log d'audit
    await prisma.auditLog.create({
      data: {
        action: "UPDATE_MEMBERSHIP_ROLE",
        resource: "membership",
        resourceId: membershipId,
        userId: currentUserId,
        organizationId,
        membershipId: currentMembership.id,
        details: JSON.stringify({ role }),
      },
    });

    return updatedMembership;
  }

  /**
   * Supprimer un membership
   */
  async deleteMembership(organizationId, membershipId, currentUserId) {
    // Vérifier les permissions (ADMIN seulement)
    const currentMembership = await prisma.membership.findFirst({
      where: {
        userId: currentUserId,
        organizationId,
        status: "ACTIVE",
        role: "ADMIN",
      },
    });

    if (!currentMembership) {
      throw new Error("Permissions insuffisantes pour supprimer un membre");
    }

    // Vérifier l'existence du membership
    const existingMembership = await prisma.membership.findUnique({
      where: { id: membershipId },
    });

    if (
      !existingMembership ||
      existingMembership.organizationId !== organizationId
    ) {
      throw new Error("Membre non trouvé dans cette organisation");
    }

    // Vérifier qu'on ne peut pas se supprimer soi-même
    if (existingMembership.userId === currentUserId) {
      throw new Error("Vous ne pouvez pas vous supprimer vous-même");
    }

    const deletedMembership = await prisma.membership.delete({
      where: { id: membershipId },
      include: {
        user: {
          select: {
            id: true,
            prenom: true,
            nom: true,
            email: true,
          },
        },
      },
    });

    // Mettre à jour l'usage de l'abonnement
    await this.#updateSubscriptionUsage(organizationId, -1);

    // Créer un log d'audit
    await prisma.auditLog.create({
      data: {
        action: "DELETE_MEMBERSHIP",
        resource: "membership",
        resourceId: membershipId,
        userId: currentUserId,
        organizationId,
        membershipId: currentMembership.id,
        details: JSON.stringify({
          userId: deletedMembership.userId,
          role: deletedMembership.role,
          wasProvisional: deletedMembership.userId === null,
        }),
      },
    });

    return deletedMembership;
  }

  /**
   * Vérifier les limites d'abonnement
   */
  async #checkSubscriptionLimits(organizationId) {
    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
    });

    if (!subscription) {
      throw new Error("Abonnement non trouvé pour cette organisation");
    }

    const memberCount = await prisma.membership.count({
      where: {
        organizationId,
        status: "ACTIVE",
      },
    });

    if (memberCount >= subscription.maxMembers) {
      throw new Error(
        `Limite de membres atteinte (${subscription.maxMembers}). Veuillez mettre à niveau votre abonnement.`,
      );
    }
  }

  /**
   * Mettre à jour l'usage de l'abonnement
   */
  async #updateSubscriptionUsage(organizationId, increment) {
    await prisma.subscription.update({
      where: { organizationId },
      data: {
        currentUsage: {
          increment,
        },
      },
    });
  }

  /**
   * Générer un loginId unique
   */
  #generateLoginId() {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  }

  /**
   * Générer un numéro de membre unique
   */
  async #generateMemberNumber(organizationId) {
    const org = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        memberCounter: { increment: 1 },
      },
      select: { memberCounter: true },
    });

    return `MBR${organizationId.slice(-6)}${org.memberCounter
      .toString()
      .padStart(3, "0")}`;
  }
}
