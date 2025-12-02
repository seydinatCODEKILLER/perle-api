import { prisma } from "../config/database.js";
import MediaUploader from "../utils/uploadMedia.js";

export default class OrganizationService {
  constructor() {
    this.mediaUploader = new MediaUploader();
  }

  async createOrganization(ownerId, organizationData, logoFile) {
    const { settings, ...orgData } = organizationData;

    let logoUrl = null;
    let logoPrefix = null;

    try {
      // Upload du logo si fourni
      if (logoFile) {
        const timestamp = Date.now();
        logoPrefix = `org_${orgData.name
          .toLowerCase()
          .replace(/\s+/g, "_")}_${timestamp}`;
        logoUrl = await this.mediaUploader.upload(
          logoFile,
          "organizations/logos",
          logoPrefix
        );
      }

      // Création de l'organisation avec transaction
      const organization = await prisma.$transaction(async (tx) => {
        // Création des paramètres de l'organisation
        const orgSettings = await tx.organizationSettings.create({
          data: {
            ...settings,
            allowPartialPayments: settings?.allowPartialPayments ?? false,
            autoReminders: settings?.autoReminders ?? true,
            reminderDays: settings?.reminderDays ?? [1, 3, 7],
            emailNotifications: settings?.emailNotifications ?? true,
            smsNotifications: settings?.smsNotifications ?? false,
            whatsappNotifications: settings?.whatsappNotifications ?? false,
            sessionTimeout: settings?.sessionTimeout ?? 60,
          },
        });

        // Création de l'organisation
        const newOrg = await tx.organization.create({
          data: {
            ...orgData,
            logo: logoUrl,
            ownerId,
            settingsId: orgSettings.id,
          },
          include: {
            owner: {
              select: {
                id: true,
                prenom: true,
                nom: true,
                email: true,
              },
            },
            settings: true,
          },
        });

        // Création automatique d'un abonnement gratuit
        await tx.subscription.create({
          data: {
            organizationId: newOrg.id,
            plan: "FREE",
            status: "ACTIVE",
            startDate: new Date(),
            maxMembers: 50,
            currentUsage: 1,
            price: 0,
            currency: "XOF",
          },
        });

        // Ajout du propriétaire comme membre ADMIN
        await tx.membership.create({
          data: {
            userId: ownerId,
            organizationId: newOrg.id,
            role: "ADMIN",
            loginId: this.#generateLoginId(),
            memberNumber: this.#generateMemberNumber(),
            status: "ACTIVE",
          },
        });

        return newOrg;
      });

      return organization;
    } catch (error) {
      // Rollback de l'upload si erreur
      if (logoUrl && logoPrefix) {
        await this.mediaUploader.rollback(logoPrefix);
      }
      throw error;
    }
  }

  async getOrganizationById(organizationId, userId) {
    // Vérifier que l'utilisateur a accès à cette organisation
    const membership = await prisma.membership.findFirst({
      where: {
        userId,
        organizationId,
        status: "ACTIVE",
      },
    });

    if (!membership) {
      throw new Error("Accès non autorisé à cette organisation");
    }

    const organization = await prisma.organization.findUnique({
      where: {
        id: organizationId,
        isActive: true,
      },
      include: {
        owner: {
          select: {
            id: true,
            prenom: true,
            nom: true,
            email: true,
          },
        },
        settings: true,
        subscription: true,
        _count: {
          select: {
            members: {
              where: { status: "ACTIVE" },
            },
            contributionPlans: {
              where: { isActive: true },
            },
            contributions: true,
          },
        },
      },
    });

    if (!organization) {
      throw new Error("Organisation non trouvée");
    }

    return organization;
  }

  async getUserOrganizations(userId) {
    const memberships = await prisma.membership.findMany({
      where: {
        userId,
        status: "ACTIVE",
      },
      include: {
        organization: {
          include: {
            owner: {
              select: {
                id: true,
                prenom: true,
                nom: true,
                email: true,
              },
            },
            settings: true,
            subscription: true,
            _count: {
              select: {
                members: {
                  where: { status: "ACTIVE" },
                },
              },
            },
          },
        },
      },
      orderBy: {
        organization: {
          createdAt: "desc",
        },
      },
    });

    return memberships.map((membership) => ({
      ...membership.organization,
      userRole: membership.role,
    }));
  }

  async updateOrganization(organizationId, userId, updateData, logoFile) {
    // Vérifier les permissions (seul le propriétaire ou un ADMIN peut modifier)
    const membership = await prisma.membership.findFirst({
      where: {
        userId,
        organizationId,
        status: "ACTIVE",
        role: { in: ["ADMIN"] },
      },
    });

    if (!membership) {
      throw new Error(
        "Permissions insuffisantes pour modifier cette organisation"
      );
    }

    let logoUrl = null;
    let logoPrefix = null;
    let oldLogoUrl = null;

    try {
      // Récupérer l'ancien logo
      const existingOrg = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { logo: true },
      });

      oldLogoUrl = existingOrg?.logo;

      // Upload du nouveau logo si fourni
      if (logoFile) {
        const timestamp = Date.now();
        logoPrefix = `org_${organizationId}_${timestamp}`;
        logoUrl = await this.mediaUploader.upload(
          logoFile,
          "organizations/logos",
          logoPrefix
        );
      }

      const updatedOrganization = await prisma.organization.update({
        where: {
          id: organizationId,
          isActive: true,
        },
        data: {
          ...updateData,
          ...(logoUrl && { logo: logoUrl }),
        },
        include: {
          owner: {
            select: {
              id: true,
              prenom: true,
              nom: true,
              email: true,
            },
          },
          settings: true,
          subscription: true,
        },
      });

      // Supprimer l'ancien logo si nouveau upload réussi
      if (logoUrl && oldLogoUrl) {
        await this.mediaUploader.deleteByUrl(oldLogoUrl);
      }

      return updatedOrganization;
    } catch (error) {
      // Rollback si nouvel upload échoue
      if (logoUrl && logoPrefix) {
        await this.mediaUploader.rollback(logoPrefix);
      }
      throw error;
    }
  }

  async updateOrganizationSettings(organizationId, userId, settingsData) {
    // Vérifier les permissions
    const membership = await prisma.membership.findFirst({
      where: {
        userId,
        organizationId,
        status: "ACTIVE",
        role: { in: ["ADMIN"] },
      },
    });

    if (!membership) {
      throw new Error("Permissions insuffisantes pour modifier les paramètres");
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: { settings: true },
    });

    if (!organization) {
      throw new Error("Organisation non trouvée");
    }

    const updatedSettings = await prisma.organizationSettings.update({
      where: { id: organization.settingsId },
      data: settingsData,
    });

    return updatedSettings;
  }

  async deactivateOrganization(organizationId, userId) {
    // Seul le propriétaire peut désactiver l'organisation
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: { owner: true },
    });

    if (!organization) {
      throw new Error("Organisation non trouvée");
    }

    if (organization.ownerId !== userId) {
      throw new Error("Seul le propriétaire peut désactiver l'organisation");
    }

    const deactivatedOrg = await prisma.organization.update({
      where: { id: organizationId },
      data: { isActive: false },
      include: {
        owner: {
          select: {
            id: true,
            prenom: true,
            nom: true,
            email: true,
          },
        },
      },
    });

    return deactivatedOrg;
  }

  async getOrganizationStats(organizationId, userId) {
    // Vérifier l'accès
    const membership = await prisma.membership.findFirst({
      where: {
        userId,
        organizationId,
        status: "ACTIVE",
      },
    });

    if (!membership) {
      throw new Error("Accès non autorisé à cette organisation");
    }

    const [
      memberCount,
      activeContributions,
      totalContributions,
      pendingContributions,
      totalDebts,
      recentTransactions,
    ] = await Promise.all([
      // Nombre de membres actifs
      prisma.membership.count({
        where: {
          organizationId,
          status: "ACTIVE",
        },
      }),

      // Plans de cotisation actifs
      prisma.contributionPlan.count({
        where: {
          organizationId,
          isActive: true,
        },
      }),

      // Total des cotisations
      prisma.contribution.aggregate({
        where: { organizationId },
        _sum: { amount: true },
      }),

      // Cotisations en attente
      prisma.contribution.count({
        where: {
          organizationId,
          status: "PENDING",
        },
      }),

      // Dettes actives
      prisma.debt.aggregate({
        where: {
          organizationId,
          status: "ACTIVE",
        },
        _sum: { remainingAmount: true },
      }),

      // Transactions récentes (30 derniers jours)
      prisma.transaction.count({
        where: {
          organizationId,
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    return {
      members: memberCount,
      activeContributionPlans: activeContributions,
      totalContributions: totalContributions._sum.amount || 0,
      pendingContributions,
      activeDebts: totalDebts._sum.remainingAmount || 0,
      recentTransactions,
    };
  }

  async searchOrganizations(userId, searchTerm, type, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const whereClause = {
      members: {
        some: {
          userId,
          status: "ACTIVE",
        },
      },
      isActive: true,
      ...(searchTerm && {
        OR: [
          { name: { contains: searchTerm, mode: "insensitive" } },
          { description: { contains: searchTerm, mode: "insensitive" } },
        ],
      }),
      ...(type && { type }),
    };

    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where: whereClause,
        include: {
          owner: {
            select: {
              id: true,
              prenom: true,
              nom: true,
              email: true,
            },
          },
          subscription: true,
          _count: {
            select: {
              members: {
                where: { status: "ACTIVE" },
              },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.organization.count({ where: whereClause }),
    ]);

    return {
      organizations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // Méthodes utilitaires privées
  #generateLoginId() {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  }

  #generateMemberNumber() {
    return `MBR${Date.now().toString().slice(-6)}`;
  }
}
