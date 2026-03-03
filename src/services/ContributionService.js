import { prisma } from "../config/database.js";

export default class ContributionService {
  constructor() {}

  /* ======================================================
     MÉTHODES D’ACCÈS & PERMISSIONS
  ====================================================== */

  async #getActiveMembership(userId, organizationId, roles = []) {
    const membership = await prisma.membership.findFirst({
      where: {
        userId,
        organizationId,
        status: "ACTIVE",
        ...(roles.length && { role: { in: roles } }),
      },
    });

    if (!membership) {
      throw new Error("Accès non autorisé à cette organisation");
    }

    return membership;
  }

  /**
   * @param {string} contributionId
   * @param {string} organizationId
   * @param {object} include
   * @returns {Promise<any>}
   */
  async #getContributionOrFail(contributionId, organizationId, include = {}) {
    const contribution = await prisma.contribution.findUnique({
      where: { id: contributionId },
      include,
    });

    if (!contribution || contribution.organizationId !== organizationId) {
      throw new Error("Cotisation non trouvée dans cette organisation");
    }

    return contribution;
  }

  #remaining(contribution) {
    return contribution.amount - contribution.amountPaid;
  }

  /* ======================================================
     LECTURE DES COTISATIONS
  ====================================================== */

  async getContributions(organizationId, currentUserId, filters = {}) {
    await this.#getActiveMembership(currentUserId, organizationId);

    const {
      status,
      membershipId,
      contributionPlanId,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = filters;

    const skip = (page - 1) * limit;

    const where = {
      organizationId,
      ...(status && { status }),
      ...(membershipId && { membershipId }),
      ...(contributionPlanId && { contributionPlanId }),
      ...(startDate || endDate
        ? {
            dueDate: {
              ...(startDate && { gte: new Date(startDate) }),
              ...(endDate && { lte: new Date(endDate) }),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.contribution.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dueDate: "asc" },
        include: {
          membership: {
            include: {
              user: {
                select: {
                  id: true,
                  prenom: true,
                  nom: true,
                  email: true,
                  phone: true,
                  gender: true, // ✅ Ajouter gender
                },
              },
            },
          },
          contributionPlan: true,
          partialPayments: { orderBy: { paymentDate: "desc" } },
          transaction: {
            include: {
              wallet: {
                select: {
                  currentBalance: true,
                  currency: true,
                },
              },
            },
          },
        },
      }),
      prisma.contribution.count({ where }),
    ]);

    // ✅ Enrichir avec displayInfo
    const enrichedData = data.map((contribution) => {
      const displayInfo = this.#getMemberDisplayInfo(contribution.membership);

      return {
        ...contribution,
        membership: {
          ...contribution.membership,
          displayInfo,
        },
        remainingAmount: this.#remaining(contribution),
      };
    });

    return {
      contributions: enrichedData,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  #getMemberDisplayInfo(membership) {
    if (!membership) return null;

    if (membership.userId && membership.user) {
      return {
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

    return {
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

  async getContributionById(organizationId, contributionId, currentUserId) {
    await this.#getActiveMembership(currentUserId, organizationId);

    const contribution = await this.#getContributionOrFail(
      contributionId,
      organizationId,
      {
        membership: {
          include: {
            user: {
              select: {
                prenom: true,
                nom: true,
                email: true,
                phone: true,
                gender: true, // ✅ Ajouter
              },
            },
          },
        },
        contributionPlan: true,
        partialPayments: { orderBy: { paymentDate: "desc" } },
        transaction: {
          include: {
            wallet: {
              select: {
                currentBalance: true,
                currency: true,
              },
            },
          },
        },
      },
    );

    // ✅ Enrichir avec displayInfo
    const displayInfo = this.#getMemberDisplayInfo(contribution.membership);

    return {
      ...contribution,
      membership: {
        ...contribution.membership,
        displayInfo,
      },
      remainingAmount: this.#remaining(contribution),
    };
  }

  /* ======================================================
     PAIEMENT COMPLET
  ====================================================== */

  async markAsPaid(organizationId, contributionId, currentUserId, paymentData) {
    const currentMembership = await this.#getActiveMembership(
      currentUserId,
      organizationId,
      ["ADMIN", "FINANCIAL_MANAGER"],
    );

    const contribution = await this.#getContributionOrFail(
      contributionId,
      organizationId,
      { contributionPlan: true },
    );

    if (contribution.status === "PAID") {
      throw new Error("Cette cotisation est déjà payée");
    }

    const remaining = this.#remaining(contribution);
    if (paymentData.amountPaid !== remaining) {
      throw new Error(`Le montant exact requis est ${remaining}`);
    }

    const result = await prisma.$transaction(async (tx) => {
      // ✅ AJOUT : Récupérer le wallet
      const wallet = await tx.organizationWallet.findUnique({
        where: { organizationId },
      });

      if (!wallet) {
        throw new Error("Wallet non trouvé pour cette organisation");
      }

      // 1. Mettre à jour la cotisation
      const updatedContribution = await tx.contribution.update({
        where: { id: contributionId },
        data: {
          amountPaid: contribution.amount,
          status: "PAID",
          paymentDate: new Date(),
          paymentMethod: paymentData.paymentMethod,
        },
        include: { contributionPlan: true },
      });

      // 2. Créer la transaction liée au wallet
      const transaction = await tx.transaction.create({
        data: {
          organizationId,
          membershipId: contribution.membershipId,
          walletId: wallet.id, // ✅ AJOUT : Lier au wallet
          type: "CONTRIBUTION",
          amount: paymentData.amountPaid,
          currency: wallet.currency,
          paymentMethod: paymentData.paymentMethod,
          paymentStatus: "COMPLETED",
          reference: `CONT-${Date.now()}-${contributionId.slice(-6)}`,
          metadata: { contributionId },
        },
      });

      // 3. Lier la transaction à la cotisation
      await tx.contribution.update({
        where: { id: contributionId },
        data: { transactionId: transaction.id },
      });

      // ✅ AJOUT : Mettre à jour le wallet
      await tx.organizationWallet.update({
        where: { id: wallet.id },
        data: {
          currentBalance: { increment: paymentData.amountPaid },
          totalIncome: { increment: paymentData.amountPaid },
        },
      });

      return updatedContribution;
    });

    // Audit log avec impact financier
    await prisma.auditLog.create({
      data: {
        action: "MARK_CONTRIBUTION_PAID",
        resource: "contribution",
        resourceId: contributionId,
        userId: currentUserId,
        organizationId,
        membershipId: currentMembership.id,
        financialImpact: paymentData.amountPaid, // ✅ AJOUT
        details: {
          amount: paymentData.amountPaid,
          contributionPlanName: contribution.contributionPlan.name,
        },
      },
    });

    await this.#sendPaymentNotification(contribution, paymentData.amountPaid);

    return result;
  }

  /* ======================================================
     PAIEMENT PARTIEL
  ====================================================== */

  async addPartialPayment(
    organizationId,
    contributionId,
    currentUserId,
    paymentData,
  ) {
    const currentMembership = await this.#getActiveMembership(
      currentUserId,
      organizationId,
      ["ADMIN", "FINANCIAL_MANAGER"],
    );

    const contribution = await this.#getContributionOrFail(
      contributionId,
      organizationId,
      {
        organization: { include: { settings: true } },
        contributionPlan: true,
      },
    );

    if (!contribution.organization.settings.allowPartialPayments) {
      throw new Error("Paiements partiels non autorisés");
    }

    if (
      paymentData.amount <= 0 ||
      paymentData.amount > this.#remaining(contribution)
    ) {
      throw new Error("Montant invalide");
    }

    const result = await prisma.$transaction(async (tx) => {
      // ✅ AJOUT : Récupérer le wallet
      const wallet = await tx.organizationWallet.findUnique({
        where: { organizationId },
      });

      if (!wallet) {
        throw new Error("Wallet non trouvé pour cette organisation");
      }

      // 1. Créer le paiement partiel
      await tx.partialPayment.create({
        data: {
          contributionId,
          amount: paymentData.amount,
          paymentMethod: paymentData.paymentMethod,
          paymentDate: new Date(),
        },
      });

      // 2. Mettre à jour la cotisation
      const newAmountPaid = contribution.amountPaid + paymentData.amount;
      const newStatus =
        newAmountPaid >= contribution.amount ? "PAID" : "PARTIAL";

      const updatedContribution = await tx.contribution.update({
        where: { id: contributionId },
        data: {
          amountPaid: newAmountPaid,
          status: newStatus,
          ...(newStatus === "PAID" && { paymentDate: new Date() }),
        },
      });

      // ✅ AJOUT : Créer transaction pour traçabilité
      await tx.transaction.create({
        data: {
          organizationId,
          membershipId: contribution.membershipId,
          walletId: wallet.id,
          type: "CONTRIBUTION",
          amount: paymentData.amount,
          currency: wallet.currency,
          paymentMethod: paymentData.paymentMethod,
          paymentStatus: "COMPLETED",
          reference: `PARTIAL-${Date.now()}-${contributionId.slice(-6)}`,
          description: `Paiement partiel pour ${contribution.contributionPlan.name}`,
          metadata: {
            contributionId,
            isPartialPayment: true,
          },
        },
      });

      // ✅ AJOUT : Mettre à jour le wallet
      await tx.organizationWallet.update({
        where: { id: wallet.id },
        data: {
          currentBalance: { increment: paymentData.amount },
          totalIncome: { increment: paymentData.amount },
        },
      });

      return updatedContribution;
    });

    // Audit log avec impact financier
    await prisma.auditLog.create({
      data: {
        action: "ADD_PARTIAL_PAYMENT",
        resource: "contribution",
        resourceId: contributionId,
        userId: currentUserId,
        organizationId,
        membershipId: currentMembership.id,
        financialImpact: paymentData.amount, // ✅ AJOUT
        details: {
          amount: paymentData.amount,
          newTotalPaid: result.amountPaid,
          contributionPlanName: contribution.contributionPlan.name,
        },
      },
    });

    return result;
  }

  /* ======================================================
     PAIEMENT PARTIEL
  ====================================================== */

  async getMemberContributions(
    organizationId,
    membershipId,
    currentUserId,
    filters = {},
  ) {
    const { status, page = 1, limit = 10 } = filters;
    const skip = (page - 1) * limit;

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

    if (
      currentMembership.role !== "ADMIN" &&
      currentMembership.id !== membershipId
    ) {
      throw new Error(
        "Permissions insuffisantes pour voir les cotisations de ce membre",
      );
    }

    const whereClause = {
      organizationId,
      membershipId,
      ...(status && { status }),
    };

    const [contributions, total] = await Promise.all([
      prisma.contribution.findMany({
        where: whereClause,
        include: {
          contributionPlan: {
            select: {
              id: true,
              name: true,
              amount: true,
              amountMale: true, // ✅ Ajouter
              amountFemale: true, // ✅ Ajouter
              differentiateByGender: true, // ✅ Ajouter
              frequency: true,
            },
          },
          partialPayments: {
            orderBy: {
              paymentDate: "desc",
            },
          },
        },
        skip,
        take: limit,
        orderBy: { dueDate: "desc" },
      }),
      prisma.contribution.count({ where: whereClause }),
    ]);

    const totals = await prisma.contribution.aggregate({
      where: whereClause,
      _sum: {
        amount: true,
        amountPaid: true,
      },
    });

    return {
      contributions: contributions.map((contribution) => ({
        ...contribution,
        remainingAmount: contribution.amount - contribution.amountPaid,
      })),
      totals: {
        totalAmount: totals._sum.amount || 0,
        totalPaid: totals._sum.amountPaid || 0,
        totalRemaining:
          (totals._sum.amount || 0) - (totals._sum.amountPaid || 0),
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getContributions(organizationId, currentUserId, filters = {}) {
    await this.#getActiveMembership(currentUserId, organizationId);

    const {
      status,
      membershipId,
      contributionPlanId,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = filters;

    const skip = (page - 1) * limit;

    const where = {
      organizationId,
      ...(status && { status }),
      ...(membershipId && { membershipId }),
      ...(contributionPlanId && { contributionPlanId }),
      ...(startDate || endDate
        ? {
            dueDate: {
              ...(startDate && { gte: new Date(startDate) }),
              ...(endDate && { lte: new Date(endDate) }),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.contribution.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dueDate: "asc" },
        include: {
          membership: {
            include: {
              user: {
                select: {
                  id: true,
                  prenom: true,
                  nom: true,
                  email: true,
                  phone: true,
                },
              },
            },
          },
          contributionPlan: true,
          partialPayments: { orderBy: { paymentDate: "desc" } },
          transaction: {
            include: {
              wallet: {
                // ✅ AJOUT : Wallet lié
                select: {
                  currentBalance: true,
                  currency: true,
                },
              },
            },
          },
        },
      }),
      prisma.contribution.count({ where }),
    ]);

    return {
      contributions: data.map((c) => ({
        ...c,
        remainingAmount: this.#remaining(c),
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getMyContributions(organizationId, currentUserId, filters = {}) {
    const membership = await this.#getActiveMembership(
      currentUserId,
      organizationId,
    );

    const { status, page = 1, limit = 10 } = filters;
    const skip = (page - 1) * limit;

    const where = {
      organizationId,
      membershipId: membership.id,
      ...(status && { status }),
    };

    const [contributions, total, totals] = await Promise.all([
      prisma.contribution.findMany({
        where,
        include: {
          contributionPlan: {
            select: {
              id: true,
              name: true,
              amount: true,
              frequency: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { dueDate: "desc" },
      }),
      prisma.contribution.count({ where }),
      prisma.contribution.aggregate({
        where,
        _sum: { amount: true, amountPaid: true },
      }),
    ]);

    return {
      contributions: contributions.map((c) => ({
        ...c,
        remainingAmount: c.amount - c.amountPaid,
      })),
      totals: {
        totalAmount: totals._sum.amount || 0,
        totalPaid: totals._sum.amountPaid || 0,
        totalRemaining:
          (totals._sum.amount || 0) - (totals._sum.amountPaid || 0),
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /* ======================================================
     NOTIFICATIONS
  ====================================================== */

  async #sendPaymentNotification(contribution, amount) {
    try {
      await prisma.notification.create({
        data: {
          organizationId: contribution.organizationId,
          membershipId: contribution.membershipId,
          type: "PAYMENT_CONFIRMATION",
          title: "Paiement confirmé",
          message: `Paiement de ${amount} XOF pour "${contribution.contributionPlan.name}"`,
          priority: "MEDIUM",
          channels: ["IN_APP"],
          status: "PENDING",
        },
      });
    } catch (error) {
      console.error("Notification error:", error);
    }
  }

  /* ======================================================
   ❌ ANNULER UNE COTISATION
====================================================== */

  async cancelContribution(
    organizationId,
    contributionId,
    currentUserId,
    reason = "",
  ) {
    const currentMembership = await this.#getActiveMembership(
      currentUserId,
      organizationId,
      ["ADMIN"],
    );

    const contribution = await this.#getContributionOrFail(
      contributionId,
      organizationId,
      { contributionPlan: true },
    );

    if (contribution.status === "CANCELLED") {
      throw new Error("Cotisation déjà annulée");
    }

    return await prisma.$transaction(async (tx) => {
      // Si déjà payée partiellement ou totalement, ajuster le wallet
      if (contribution.amountPaid > 0) {
        const wallet = await tx.organizationWallet.findUnique({
          where: { organizationId },
        });

        if (wallet) {
          await tx.organizationWallet.update({
            where: { id: wallet.id },
            data: {
              currentBalance: { decrement: contribution.amountPaid },
              totalIncome: { decrement: contribution.amountPaid },
            },
          });
        }
      }

      // Annuler la cotisation
      const cancelledContribution = await tx.contribution.update({
        where: { id: contributionId },
        data: {
          status: "CANCELLED",
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          action: "CANCEL_CONTRIBUTION",
          resource: "contribution",
          resourceId: contributionId,
          userId: currentUserId,
          organizationId,
          membershipId: currentMembership.id,
          financialImpact: -contribution.amountPaid,
          details: {
            reason,
            amountPaid: contribution.amountPaid,
            walletAdjusted: contribution.amountPaid > 0,
          },
        },
      });

      return cancelledContribution;
    });
  }
}
