import { prisma } from "../config/database.js";
import MediaUploader from "../utils/uploadMedia.js";

export default class OrganizationService {
  constructor() {
    this.mediaUploader = new MediaUploader();
  }

  async createOrganization(ownerId, organizationData, logoFile) {
    const { settings, wallet, ...orgData } = organizationData; // ✅ Extraire wallet

    let logoUrl = null;
    let logoPrefix = null;

    try {
      if (logoFile) {
        const timestamp = Date.now();
        logoPrefix = `org_${orgData.name.toLowerCase().replace(/\s+/g, "_")}_${timestamp}`;
        logoUrl = await this.mediaUploader.upload(
          logoFile,
          "organizations/logos",
          logoPrefix,
        );
      }

      const organization = await prisma.$transaction(async (tx) => {
        // 1. Création des paramètres
        const orgSettings = await tx.organizationSettings.create({
          data: {
            allowPartialPayments: settings?.allowPartialPayments ?? false,
            autoReminders: settings?.autoReminders ?? true,
            reminderDays: settings?.reminderDays ?? [1, 3, 7],
            emailNotifications: settings?.emailNotifications ?? true,
            smsNotifications: settings?.smsNotifications ?? false,
            whatsappNotifications: settings?.whatsappNotifications ?? false,
            sessionTimeout: settings?.sessionTimeout ?? 60,
          },
        });

        // 2. Création de l'organisation
        const newOrg = await tx.organization.create({
          data: {
            ...orgData,
            logo: logoUrl,
            ownerId,
            settingsId: orgSettings.id,
          },
          include: {
            owner: {
              select: { id: true, prenom: true, nom: true, email: true },
            },
            settings: true,
          },
        });

        // 3. ✅ Création automatique du Wallet avec initialBalance
        const initialBalance = parseFloat(wallet?.initialBalance) || 0;

        await tx.organizationWallet.create({
          data: {
            organizationId: newOrg.id,
            initialBalance: initialBalance,
            currentBalance: initialBalance, // ✅ Le solde actuel = solde initial
            totalIncome: initialBalance > 0 ? initialBalance : 0, // ✅ Si balance initiale > 0, c'est un revenu
            totalExpenses: 0,
            currency: newOrg.currency || "XOF",
          },
        });

        // 4. Création de l'abonnement
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

        // 5. Ajout du propriétaire comme ADMIN
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

        // 6. ✅ Audit log avec initialBalance
        await tx.auditLog.create({
          data: {
            organizationId: newOrg.id,
            userId: ownerId,
            action: "CREATE_ORGANIZATION_WITH_WALLET",
            resource: "Organization",
            resourceId: newOrg.id,
            details: {
              organizationName: newOrg.name,
              walletCreated: true,
              initialBalance: initialBalance,
            },
          },
        });

        return newOrg;
      });

      return organization;
    } catch (error) {
      if (logoUrl && logoPrefix) {
        await this.mediaUploader.rollback(logoPrefix);
      }
      throw error;
    }
  }

  async getOrganizationById(organizationId, userId) {
    const [organization, membership] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId, isActive: true },
        include: {
          owner: {
            select: {
              id: true,
              prenom: true,
              nom: true,
              email: true,
              phone: true,
            },
          },
          settings: true,
          subscription: true,
          wallet: true, // ✅ AJOUT : Inclure le wallet
          _count: {
            select: {
              members: { where: { status: "ACTIVE" } },
              contributionPlans: { where: { isActive: true } },
              contributions: { where: { status: { in: ["PAID", "PARTIAL"] } } },
              debts: {
                where: { status: { in: ["ACTIVE", "PARTIALLY_PAID"] } },
              },
            },
          },
        },
      }),
      prisma.membership.findFirst({
        where: { userId, organizationId, status: "ACTIVE" },
        select: {
          id: true,
          role: true,
          joinDate: true,
          status: true,
          loginId: true,
          memberNumber: true,
          createdAt: true,
          profile: true,
        },
      }),
    ]);

    if (!organization) throw new Error("Organisation non trouvée");
    if (!membership) throw new Error("Accès non autorisé à cette organisation");

    return {
      ...organization,
      userRole: membership.role,
      userMembership: membership,
    };
  }

  async getUserOrganizations(userId) {
    const memberships = await prisma.membership.findMany({
      where: {
        userId,
        status: "ACTIVE",
        organization: { isActive: true },
      },
      include: {
        organization: {
          include: {
            owner: {
              select: { id: true, prenom: true, nom: true, email: true },
            },
            settings: true,
            subscription: true,
            wallet: true, // ✅ AJOUT : Inclure le wallet
            _count: {
              select: {
                members: { where: { status: "ACTIVE" } },
              },
            },
          },
        },
      },
      orderBy: {
        organization: { createdAt: "desc" },
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
        "Permissions insuffisantes pour modifier cette organisation",
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
          logoPrefix,
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
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        owner: true,
        wallet: true, // ✅ AJOUT
      },
    });

    if (!organization) throw new Error("Organisation non trouvée");
    if (organization.ownerId !== userId) {
      throw new Error("Seul le propriétaire peut désactiver l'organisation");
    }

    // ✅ NOUVEAU : Vérifier que le wallet est soldé
    if (organization.wallet && organization.wallet.currentBalance !== 0) {
      throw new Error(
        `Impossible de désactiver : le portefeuille contient ${organization.wallet.currentBalance} ${organization.wallet.currency}. Veuillez d'abord solder le compte.`,
      );
    }

    const deactivatedOrg = await prisma.organization.update({
      where: { id: organizationId },
      data: { isActive: false },
      include: {
        owner: {
          select: { id: true, prenom: true, nom: true, email: true },
        },
      },
    });

    return deactivatedOrg;
  }

  /**
   * Réactiver une organisation (isActive = true)
   */
  async reactivateOrganization(organizationId, userId) {
    // Seul le propriétaire peut réactiver
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: { owner: true },
    });

    if (!organization) throw new Error("Organisation non trouvée");

    if (organization.ownerId !== userId) {
      throw new Error("Seul le propriétaire peut réactiver l'organisation");
    }

    if (organization.isActive) {
      throw new Error("L'organisation est déjà active");
    }

    const reactivatedOrg = await prisma.organization.update({
      where: { id: organizationId },
      data: { isActive: true },
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

    return reactivatedOrg;
  }

  async getOrganizationStats(organizationId, userId) {
    const membership = await prisma.membership.findFirst({
      where: { userId, organizationId, status: "ACTIVE" },
    });

    if (!membership) throw new Error("Accès non autorisé à cette organisation");

    const [
      memberCount,
      activeContributions,
      totalContributions,
      pendingContributions,
      totalDebts,
      recentTransactions,
      wallet, // ✅ AJOUT
      totalIncome, // ✅ AJOUT
      totalExpenses, // ✅ AJOUT
    ] = await Promise.all([
      prisma.membership.count({
        where: { organizationId, status: "ACTIVE" },
      }),

      prisma.contributionPlan.count({
        where: { organizationId, isActive: true },
      }),

      prisma.contribution.aggregate({
        where: { organizationId },
        _sum: { amount: true },
      }),

      prisma.contribution.count({
        where: { organizationId, status: "PENDING" },
      }),

      prisma.debt.aggregate({
        where: { organizationId, status: "ACTIVE" },
        _sum: { remainingAmount: true },
      }),

      prisma.transaction.count({
        where: {
          organizationId,
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),

      // ✅ NOUVEAU : Stats du wallet
      prisma.organizationWallet.findUnique({
        where: { organizationId },
        select: {
          currentBalance: true,
          totalIncome: true,
          totalExpenses: true,
          currency: true,
        },
      }),

      // ✅ NOUVEAU : Total des revenus (transactions)
      prisma.transaction.aggregate({
        where: {
          organizationId,
          paymentStatus: "COMPLETED",
          type: { in: ["CONTRIBUTION", "DEBT_REPAYMENT", "DONATION"] },
        },
        _sum: { amount: true },
      }),

      // ✅ NOUVEAU : Total des dépenses
      prisma.expense.aggregate({
        where: {
          organizationId,
          status: { in: ["APPROVED", "PAID"] },
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      members: memberCount,
      activeContributionPlans: activeContributions,
      totalContributions: totalContributions._sum.amount || 0,
      pendingContributions,
      activeDebts: totalDebts._sum.remainingAmount || 0,
      recentTransactions,

      // ✅ NOUVEAU : Stats financières
      financial: {
        currentBalance: wallet?.currentBalance || 0,
        totalIncome: totalIncome._sum.amount || 0,
        totalExpenses: totalExpenses._sum.amount || 0,
        currency: wallet?.currency || "XOF",
        netBalance:
          (totalIncome._sum.amount || 0) - (totalExpenses._sum.amount || 0),
      },
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

  async getInactiveOrganizations(userId, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const whereClause = {
      isActive: false,
      members: {
        some: {
          userId,
          status: "ACTIVE", // ✅ Sécurité : accès valide
        },
      },
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

          // Récupération DU membership de l'utilisateur
          members: {
            where: {
              userId,
              status: "ACTIVE",
            },
            select: {
              role: true,
              status: true,
              joinDate: true,
            },
            take: 1,
          },

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
        orderBy: { updatedAt: "desc" },
      }),

      prisma.organization.count({ where: whereClause }),
    ]);

    return {
      organizations: organizations.map((org) => ({
        ...org,
        userRole: org.members[0].role,
        userMembershipStatus: org.members[0].status,
        members: undefined,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  async settleWallet(organizationId, userId) {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        owner: true,
        wallet: true,
      },
    });

    if (!organization) {
      throw new Error("Organisation non trouvée");
    }

    if (organization.ownerId !== userId) {
      throw new Error("Seul le propriétaire peut solder le portefeuille");
    }

    if (!organization.wallet) {
      throw new Error("Cette organisation n'a pas de portefeuille");
    }

    if (organization.wallet.currentBalance === 0) {
      throw new Error("Le portefeuille est déjà soldé (solde = 0)");
    }

    const previousBalance = organization.wallet.currentBalance;
    const currency = organization.wallet.currency;

    try {
      const result = await prisma.$transaction(async (tx) => {
        const updatedWallet = await tx.organizationWallet.update({
          where: { organizationId },
          data: {
            currentBalance: 0,
          },
        });

        // ✅ CORRECTION : Référence unique avec UUID
        const reference = `SETTLE-${organizationId}-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

        await tx.transaction.create({
          data: {
            organizationId,
            type: "WALLET_SETTLEMENT",
            amount: Math.abs(previousBalance),
            paymentStatus: "COMPLETED",
            paymentMethod: "INTERNAL",
            reference, // ✅ Ajout de la référence unique
            description: `Solde du portefeuille - Balance précédente: ${previousBalance} ${currency}`,
            metadata: {
              previousBalance,
              newBalance: 0,
              settledBy: userId,
              settledAt: new Date().toISOString(),
            },
          },
        });

        await tx.auditLog.create({
          data: {
            organizationId,
            userId,
            action: "SETTLE_WALLET",
            resource: "OrganizationWallet",
            resourceId: updatedWallet.id,
            details: {
              previousBalance,
              newBalance: 0,
              currency,
              settledAt: new Date().toISOString(),
              reason: "Manual wallet settlement by owner",
            },
          },
        });

        return updatedWallet;
      });

      return {
        wallet: result,
        previousBalance,
        newBalance: 0,
        currency,
        message: `Portefeuille soldé avec succès. Solde précédent: ${previousBalance} ${currency}`,
      };
    } catch (error) {
      console.error("Erreur lors du solde du wallet:", error);
      throw new Error(`Impossible de solder le portefeuille: ${error.message}`);
    }
  }

  async updateWallet(organizationId, userId, walletData) {
    const [organization, membership] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        include: { wallet: true },
      }),
      prisma.membership.findFirst({
        where: {
          userId,
          organizationId,
          status: "ACTIVE",
          role: { in: ["ADMIN"] },
        },
      }),
    ]);

    if (!organization) {
      throw new Error("Organisation non trouvée");
    }

    if (!membership && organization.ownerId !== userId) {
      throw new Error(
        "Permissions insuffisantes pour modifier le portefeuille",
      );
    }

    if (!organization.wallet) {
      throw new Error("Cette organisation n'a pas de portefeuille");
    }

    const previousState = {
      currentBalance: organization.wallet.currentBalance,
      initialBalance: organization.wallet.initialBalance,
      totalIncome: organization.wallet.totalIncome,
      totalExpenses: organization.wallet.totalExpenses,
    };

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Mise à jour du wallet
        const updatedWallet = await tx.organizationWallet.update({
          where: { organizationId },
          data: {
            ...(walletData.initialBalance !== undefined && {
              initialBalance: parseFloat(walletData.initialBalance),
            }),
            ...(walletData.currentBalance !== undefined && {
              currentBalance: parseFloat(walletData.currentBalance),
            }),
            ...(walletData.totalIncome !== undefined && {
              totalIncome: parseFloat(walletData.totalIncome),
            }),
            ...(walletData.totalExpenses !== undefined && {
              totalExpenses: parseFloat(walletData.totalExpenses),
            }),
          },
        });

        // Audit log
        await tx.auditLog.create({
          data: {
            organizationId,
            userId,
            action: "UPDATE_WALLET",
            resource: "OrganizationWallet",
            resourceId: updatedWallet.id,
            details: {
              previousState,
              newState: {
                currentBalance: updatedWallet.currentBalance,
                initialBalance: updatedWallet.initialBalance,
                totalIncome: updatedWallet.totalIncome,
                totalExpenses: updatedWallet.totalExpenses,
              },
              updatedFields: Object.keys(walletData),
              updatedAt: new Date().toISOString(),
            },
          },
        });

        return updatedWallet;
      });

      return result;
    } catch (error) {
      console.error("Erreur lors de la mise à jour du wallet:", error);
      throw new Error(
        `Impossible de mettre à jour le portefeuille: ${error.message}`,
      );
    }
  }

  // Méthodes utilitaires privées
  #generateLoginId() {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  }

  #generateMemberNumber() {
    return `MBR${Date.now().toString().slice(-6)}`;
  }
}
