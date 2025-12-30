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
                },
              },
            },
          },
          contributionPlan: true,
          partialPayments: { orderBy: { paymentDate: "desc" } },
          transaction: true,
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
              },
            },
          },
        },
        contributionPlan: true,
        partialPayments: { orderBy: { paymentDate: "desc" } },
        transaction: true,
      }
    );

    return {
      ...contribution,
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
      ["ADMIN", "FINANCIAL_MANAGER"]
    );

    const contribution = await this.#getContributionOrFail(
      contributionId,
      organizationId,
      { contributionPlan: true }
    );

    if (contribution.status === "PAID") {
      throw new Error("Cette cotisation est déjà payée");
    }

    const remaining = this.#remaining(contribution);
    if (paymentData.amountPaid !== remaining) {
      throw new Error(`Le montant exact requis est ${remaining}`);
    }

    const result = await prisma.$transaction(async (tx) => {
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

      const transaction = await tx.transaction.create({
        data: {
          organizationId,
          membershipId: contribution.membershipId,
          type: "CONTRIBUTION",
          amount: paymentData.amountPaid,
          currency: "XOF",
          paymentMethod: paymentData.paymentMethod,
          paymentStatus: "COMPLETED",
          reference: `CONT-${Date.now()}-${contributionId.slice(-6)}`,
          metadata: { contributionId },
        },
      });

      await tx.contribution.update({
        where: { id: contributionId },
        data: { transactionId: transaction.id },
      });

      return updatedContribution;
    });

    await prisma.auditLog.create({
      data: {
        action: "MARK_CONTRIBUTION_PAID",
        resource: "contribution",
        resourceId: contributionId,
        userId: currentUserId,
        organizationId,
        membershipId: currentMembership.id,
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
    paymentData
  ) {
    const currentMembership = await this.#getActiveMembership(
      currentUserId,
      organizationId,
      ["ADMIN", "FINANCIAL_MANAGER"]
    );

    const contribution = await this.#getContributionOrFail(
      contributionId,
      organizationId,
      {
        organization: { include: { settings: true } },
        contributionPlan: true,
      }
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
      await tx.partialPayment.create({
        data: {
          contributionId,
          amount: paymentData.amount,
          paymentMethod: paymentData.paymentMethod,
          paymentDate: new Date(),
        },
      });

      const newAmountPaid = contribution.amountPaid + paymentData.amount;
      const newStatus =
        newAmountPaid >= contribution.amount ? "PAID" : "PARTIAL";

      return tx.contribution.update({
        where: { id: contributionId },
        data: {
          amountPaid: newAmountPaid,
          status: newStatus,
          ...(newStatus === "PAID" && { paymentDate: new Date() }),
        },
      });
    });

    await prisma.auditLog.create({
      data: {
        action: "ADD_PARTIAL_PAYMENT",
        resource: "contribution",
        resourceId: contributionId,
        userId: currentUserId,
        organizationId,
        membershipId: currentMembership.id,
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
    filters = {}
  ) {
    const { status, page = 1, limit = 10 } = filters;
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

    if (
      currentMembership.role !== "ADMIN" &&
      currentMembership.id !== membershipId
    ) {
      throw new Error(
        "Permissions insuffisantes pour voir les cotisations de ce membre"
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

    // Calculer les totaux
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
}
