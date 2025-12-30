import { prisma } from "../config/database.js";

export default class MembershipService {
  constructor() {}

  async createMembership(organizationId, currentUserId, membershipData) {
    // Vérifier les permissions (ADMIN ou FINANCIAL_MANAGER seulement)
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

    // Vérifier les limites d'abonnement
    await this.#checkSubscriptionLimits(organizationId);

    const { phone } = membershipData;

    // Si userId n'est pas fourni, chercher téléphone
    const user = await prisma.user.findUnique({
      where: { phone },
    });

    if (!user) {
      throw new Error(
        "Utilisateur non trouvé. Veuillez fournir un userId valide."
      );
    }

    // Vérifier si l'utilisateur est déjà membre
    const existingMembership = await prisma.membership.findFirst({
      where: {
        userId: user.id,
        organizationId,
      },
    });

    if (existingMembership) {
      throw new Error("Cet utilisateur est déjà membre de cette organisation");
    }

    // Créer le membership
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

    // Mettre à jour l'usage de l'abonnement
    await this.#updateSubscriptionUsage(organizationId, 1);

    // Créer un log d'audit
    await prisma.auditLog.create({
      data: {
        action: "CREATE_MEMBERSHIP",
        resource: "membership",
        resourceId: membership.id,
        userId: currentUserId,
        organizationId,
        membershipId: currentMembership.id,
        details: JSON.stringify({
          userId: membership.userId,
          role: membership.role,
          memberNumber: membership.memberNumber,
        }),
      },
    });

    return membership;
  }

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

    return membership;
  }

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

    return {
      members: memberships,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async updateMembership(
    organizationId,
    membershipId,
    currentUserId,
    updateData
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

  async updateMembershipStatus(
    organizationId,
    membershipId,
    currentUserId,
    status
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
        "Permissions insuffisantes pour modifier le statut d'un membre"
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

  async updateMembershipRole(
    organizationId,
    membershipId,
    currentUserId,
    role
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
        "Permissions insuffisantes pour modifier le rôle d'un membre"
      );
    }

    if(!role) throw new Error("Le rôle est requis");

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
        }),
      },
    });

    return deletedMembership;
  }

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
        `Limite de membres atteinte (${subscription.maxMembers}). Veuillez mettre à niveau votre abonnement.`
      );
    }
  }

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

  #generateLoginId() {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  }

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
