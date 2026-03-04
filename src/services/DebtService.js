// services/DebtService.js

import { prisma } from "../config/database.js";

/* =========================
   CONSTANTES METIER
========================= */

const ROLES = {
  ADMIN: "ADMIN",
  FINANCIAL_MANAGER: "FINANCIAL_MANAGER",
};

const DEBT_STATUS = {
  ACTIVE: "ACTIVE",
  PARTIALLY_PAID: "PARTIALLY_PAID",
  PAID: "PAID",
  OVERDUE: "OVERDUE",
  CANCELLED: "CANCELLED",
};

export default class DebtService {
  /* ======================================================
     HELPERS PRIVÉS
  ====================================================== */

  async #requireMembership(userId, organizationId, roles = []) {
    const membership = await prisma.membership.findFirst({
      where: {
        userId,
        organizationId,
        status: "ACTIVE",
        ...(roles.length && { role: { in: roles } }),
      },
    });

    if (!membership) {
      throw new Error("Accès non autorisé");
    }

    return membership;
  }

  /**
   * ✅ Helper pour obtenir les infos d'affichage d'un membre
   */
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

  /**
   * ✅ Include standard pour membership avec toutes les données
   */
  #getMembershipInclude() {
    return {
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
    };
  }

  _parseAmount(value, label = "montant") {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error(`Le ${label} est invalide`);
    }
    return amount;
  }

  _computeDebtStatus(remaining, initial) {
    if (remaining <= 0) return DEBT_STATUS.PAID;
    if (remaining < initial) return DEBT_STATUS.PARTIALLY_PAID;
    return DEBT_STATUS.ACTIVE;
  }

  /* ======================================================
     CRÉATION DE DETTE
  ====================================================== */

  async createDebt(organizationId, currentUserId, debtData) {
    const currentMembership = await this.#requireMembership(
      currentUserId,
      organizationId,
      ["ADMIN", "FINANCIAL_MANAGER"],
    );

    // ✅ Vérifier que le membre existe avec toutes les données
    const membership = await prisma.membership.findUnique({
      where: { id: debtData.membershipId },
      ...this.#getMembershipInclude(),
    });

    if (!membership || membership.organizationId !== organizationId) {
      throw new Error("Membre non trouvé dans cette organisation");
    }

    const initialAmount = this._parseAmount(
      debtData.initialAmount,
      "montant initial",
    );

    const debt = await prisma.debt.create({
      data: {
        membershipId: debtData.membershipId,
        organizationId,
        title: debtData.title,
        description: debtData.description || "",
        initialAmount,
        remainingAmount: initialAmount,
        dueDate: debtData.dueDate ? new Date(debtData.dueDate) : null,
        status: "ACTIVE",
      },
      include: {
        membership: this.#getMembershipInclude(),
      },
    });

    // ✅ Audit log
    const displayInfo = this.#getMemberDisplayInfo(debt.membership);
    await prisma.auditLog.create({
      data: {
        action: "CREATE_DEBT",
        resource: "debt",
        resourceId: debt.id,
        userId: currentUserId,
        organizationId,
        membershipId: currentMembership.id,
        details: JSON.stringify({
          membershipId: debtData.membershipId,
          memberName: `${displayInfo.firstName} ${displayInfo.lastName}`,
          isProvisional: displayInfo.isProvisional,
          amount: initialAmount,
        }),
      },
    });

    // ✅ Enrichir avec displayInfo
    return {
      ...debt,
      membership: {
        ...debt.membership,
        displayInfo: this.#getMemberDisplayInfo(debt.membership),
      },
    };
  }

  /* ======================================================
     RÉCUPÉRATION DES DETTES
  ====================================================== */

  async getOrganizationDebts(organizationId, currentUserId, filters = {}) {
    await this.#requireMembership(currentUserId, organizationId);

    const { status, membershipId, search, page = 1, limit = 10 } = filters;
    const skip = (page - 1) * limit;

    const where = {
      organizationId,
      ...(status && { status }),
      ...(membershipId && { membershipId }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          {
            membership: {
              OR: [
                {
                  user: {
                    OR: [
                      { prenom: { contains: search, mode: "insensitive" } },
                      { nom: { contains: search, mode: "insensitive" } },
                    ],
                  },
                },
                {
                  provisionalFirstName: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
                {
                  provisionalLastName: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              ],
            },
          },
        ],
      }),
    };

    const [debts, total] = await Promise.all([
      prisma.debt.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          membership: this.#getMembershipInclude(), // ✅ Include complet
          repayments: {
            take: 3,
            orderBy: { paymentDate: "desc" },
          },
        },
      }),
      prisma.debt.count({ where }),
    ]);

    // ✅ Enrichir avec displayInfo
    const enrichedDebts = debts.map((debt) => ({
      ...debt,
      membership: {
        ...debt.membership,
        displayInfo: this.#getMemberDisplayInfo(debt.membership),
      },
    }));

    return {
      debts: enrichedDebts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getDebtById(organizationId, debtId, currentUserId) {
    await this.#requireMembership(currentUserId, organizationId);

    const debt = await prisma.debt.findFirst({
      where: { id: debtId, organizationId },
      include: {
        membership: this.#getMembershipInclude(), // ✅ Include complet
        repayments: {
          orderBy: { paymentDate: "desc" },
          include: {
            transaction: {
              select: {
                id: true,
                reference: true,
                paymentStatus: true,
                paymentMethod: true,
              },
            },
          },
        },
      },
    });

    if (!debt) {
      throw new Error("Dette non trouvée");
    }

    // ✅ Enrichir avec displayInfo
    return {
      ...debt,
      membership: {
        ...debt.membership,
        displayInfo: this.#getMemberDisplayInfo(debt.membership),
      },
    };
  }

  async getMemberDebts(
    organizationId,
    membershipId,
    currentUserId,
    filters = {},
  ) {
    const currentMembership = await this.#requireMembership(
      currentUserId,
      organizationId,
    );

    // Vérifier les permissions
    if (
      currentMembership.role !== "ADMIN" &&
      currentMembership.role !== "FINANCIAL_MANAGER" &&
      currentMembership.id !== membershipId
    ) {
      throw new Error("Permissions insuffisantes");
    }

    const { status, page = 1, limit = 10 } = filters;
    const skip = (page - 1) * limit;

    const where = {
      organizationId,
      membershipId,
      ...(status && { status }),
    };

    const [debts, total, totals] = await Promise.all([
      prisma.debt.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dueDate: "desc" },
        include: {
          membership: this.#getMembershipInclude(), // ✅ Include complet
          repayments: {
            orderBy: { paymentDate: "desc" },
          },
        },
      }),
      prisma.debt.count({ where }),
      prisma.debt.aggregate({
        where,
        _sum: {
          initialAmount: true,
          remainingAmount: true,
        },
      }),
    ]);

    // ✅ Enrichir avec displayInfo
    const enrichedDebts = debts.map((debt) => ({
      ...debt,
      membership: {
        ...debt.membership,
        displayInfo: this.#getMemberDisplayInfo(debt.membership),
      },
    }));

    return {
      debts: enrichedDebts,
      totals: {
        totalInitial: totals._sum.initialAmount || 0,
        totalRemaining: totals._sum.remainingAmount || 0,
        totalRepaid:
          (totals._sum.initialAmount || 0) - (totals._sum.remainingAmount || 0),
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getMyDebts(organizationId, currentUserId, filters = {}) {
    // 1. Vérifier que l'utilisateur est membre actif
    const membership = await this.#requireMembership(
      currentUserId,
      organizationId,
    );

    const { status, page = 1, limit = 10 } = filters;
    const skip = (page - 1) * limit;

    // 2. Filtres
    const where = {
      organizationId,
      membershipId: membership.id,
      ...(status && { status }),
    };

    // 3. Récupération des dettes + agrégats
    const [debts, total, totals] = await Promise.all([
      prisma.debt.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          membership: this.#getMembershipInclude(),
          repayments: {
            orderBy: { paymentDate: "desc" },
          },
        },
      }),

      prisma.debt.count({ where }),

      prisma.debt.aggregate({
        where,
        _sum: {
          initialAmount: true,
          remainingAmount: true,
        },
      }),
    ]);

    // 4. Enrichissement (displayInfo)
    const enrichedDebts = debts.map((debt) => ({
      ...debt,
      membership: {
        ...debt.membership,
        displayInfo: this.#getMemberDisplayInfo(debt.membership),
      },
    }));

    // 5. Réponse finale
    return {
      debts: enrichedDebts,
      totals: {
        totalDebts: totals._sum.initialAmount || 0,
        totalRemaining: totals._sum.remainingAmount || 0,
        totalRepaid:
          (totals._sum.initialAmount || 0) - (totals._sum.remainingAmount || 0),
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
     REPAYMENTS
  ====================================================== */

  async getDebtRepayments(organizationId, debtId, currentUserId) {
    await this.#requireMembership(currentUserId, organizationId);

    const debt = await prisma.debt.findUnique({
      where: { id: debtId },
    });

    if (!debt || debt.organizationId !== organizationId) {
      throw new Error("Dette introuvable");
    }

    const repayments = await prisma.repayment.findMany({
      where: { debtId },
      include: {
        transaction: {
          select: {
            id: true,
            reference: true,
            paymentStatus: true,
            paymentMethod: true,
          },
        },
      },
      orderBy: { paymentDate: "desc" },
    });

    const totalRepaid = repayments.reduce((sum, r) => sum + r.amount, 0);
    const repaymentRate = debt.initialAmount
      ? Math.round((totalRepaid / debt.initialAmount) * 100)
      : 0;

    return {
      debtId,
      debtTitle: debt.title,
      initialAmount: debt.initialAmount,
      remainingAmount: debt.remainingAmount,
      status: debt.status,
      totalRepaid,
      repaymentRate,
      repayments,
    };
  }

  async addRepayment(organizationId, debtId, currentUserId, repaymentData) {
    const amount = Number(repaymentData.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Montant invalide");
    }

    const allowedMethods = ["CASH", "MOBILE_MONEY", "BANK_TRANSFER"];
    if (!allowedMethods.includes(repaymentData.paymentMethod)) {
      throw new Error("Méthode de paiement invalide");
    }

    const currentMembership = await this.#requireMembership(
      currentUserId,
      organizationId,
      ["ADMIN", "FINANCIAL_MANAGER"],
    );

    const result = await prisma.$transaction(async (tx) => {
      const debt = await tx.debt.findUnique({
        where: { id: debtId },
      });

      if (!debt || debt.organizationId !== organizationId) {
        throw new Error("Dette non trouvée");
      }

      if (debt.status === "PAID") {
        throw new Error("Dette déjà payée");
      }

      if (debt.status === "CANCELLED") {
        throw new Error("Impossible de rembourser une dette annulée");
      }

      if (amount > debt.remainingAmount) {
        throw new Error(
          `Montant trop élevé. Reste à payer: ${debt.remainingAmount}`,
        );
      }

      // ✅ Récupérer le wallet
      const wallet = await tx.organizationWallet.findUnique({
        where: { organizationId },
      });

      if (!wallet) {
        throw new Error("Wallet non trouvé pour cette organisation");
      }

      // 1. Créer le remboursement
      const repayment = await tx.repayment.create({
        data: {
          debtId,
          amount,
          paymentDate: new Date(),
          paymentMethod: repaymentData.paymentMethod,
        },
      });

      // 2. Mettre à jour la dette
      const newRemainingAmount = debt.remainingAmount - amount;
      const newStatus = newRemainingAmount === 0 ? "PAID" : "PARTIALLY_PAID";

      const updatedDebt = await tx.debt.update({
        where: { id: debtId },
        data: {
          remainingAmount: newRemainingAmount,
          status: newStatus,
        },
      });

      // 3. Créer la transaction
      const transaction = await tx.transaction.create({
        data: {
          organizationId,
          membershipId: debt.membershipId,
          walletId: wallet.id,
          type: "DEBT_REPAYMENT",
          amount,
          currency: wallet.currency,
          description: `Remboursement de dette: ${debt.title}`,
          paymentMethod: repaymentData.paymentMethod,
          paymentStatus: "COMPLETED",
          reference: `REPAY-${Date.now()}-${debtId.slice(-6)}`,
          metadata: JSON.stringify({
            debtId,
            repaymentId: repayment.id,
          }),
        },
      });

      // 4. Lier la transaction au remboursement
      await tx.repayment.update({
        where: { id: repayment.id },
        data: { transactionId: transaction.id },
      });

      // 5. Mettre à jour le wallet
      await tx.organizationWallet.update({
        where: { id: wallet.id },
        data: {
          currentBalance: { increment: amount },
          totalIncome: { increment: amount },
        },
      });

      return updatedDebt;
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: "ADD_REPAYMENT",
        resource: "debt",
        resourceId: debtId,
        userId: currentUserId,
        organizationId,
        membershipId: currentMembership.id,
        financialImpact: amount,
        details: JSON.stringify({
          amount,
          paymentMethod: repaymentData.paymentMethod,
          debtTitle: result.title,
        }),
      },
    });

    return result;
  }

  /* ======================================================
     UPDATE STATUS
  ====================================================== */

  async updateDebtStatus(organizationId, debtId, currentUserId, status) {
    const membership = await this.#requireMembership(
      currentUserId,
      organizationId,
      [ROLES.ADMIN],
    );

    if (!Object.values(DEBT_STATUS).includes(status)) {
      throw new Error("Statut de dette invalide");
    }

    const debt = await prisma.debt.findUnique({
      where: { id: debtId },
    });

    if (!debt || debt.organizationId !== organizationId) {
      throw new Error("Dette introuvable");
    }

    const updatedDebt = await prisma.debt.update({
      where: { id: debtId },
      data: { status },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE_DEBT_STATUS",
        resource: "debt",
        resourceId: debtId,
        userId: currentUserId,
        organizationId,
        membershipId: membership.id,
        details: JSON.stringify({
          previousStatus: debt.status,
          newStatus: status,
        }),
      },
    });

    return updatedDebt;
  }

  /* ======================================================
     CANCEL DEBT
  ====================================================== */

  async cancelDebt(organizationId, debtId, currentUserId, reason = "") {
    const membership = await this.#requireMembership(
      currentUserId,
      organizationId,
      [ROLES.ADMIN],
    );

    return await prisma.$transaction(async (tx) => {
      const debt = await tx.debt.findUnique({
        where: { id: debtId },
        include: {
          repayments: true,
        },
      });

      if (!debt || debt.organizationId !== organizationId) {
        throw new Error("Dette introuvable");
      }

      if (debt.status === "CANCELLED") {
        throw new Error("Dette déjà annulée");
      }

      // Calculer le montant déjà remboursé
      const totalRepaid = debt.initialAmount - debt.remainingAmount;

      // ✅ Si remboursement partiel : ajuster le wallet (retirer ce qui a été payé)
      if (totalRepaid > 0) {
        const wallet = await tx.organizationWallet.findUnique({
          where: { organizationId },
        });

        if (wallet) {
          await tx.organizationWallet.update({
            where: { id: wallet.id },
            data: {
              currentBalance: { decrement: totalRepaid },
              totalIncome: { decrement: totalRepaid },
            },
          });
        }
      }

      // Mettre à jour la dette
      const cancelledDebt = await tx.debt.update({
        where: { id: debtId },
        data: {
          status: "CANCELLED",
          remainingAmount: 0,
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          action: "CANCEL_DEBT",
          resource: "debt",
          resourceId: debtId,
          userId: currentUserId,
          organizationId,
          membershipId: membership.id,
          financialImpact: -totalRepaid,
          details: JSON.stringify({
            reason,
            amountRepaid: totalRepaid,
            walletAdjusted: totalRepaid > 0,
          }),
        },
      });

      return cancelledDebt;
    });
  }

  /* ======================================================
     SUMMARY
  ====================================================== */

  async getDebtSummary(organizationId, currentUserId) {
    await this.#requireMembership(currentUserId, organizationId);

    const [
      totalDebts,
      activeDebts,
      overdueDebts,
      paidDebts,
      recentRepayments,
      wallet,
    ] = await Promise.all([
      prisma.debt.aggregate({
        where: { organizationId },
        _sum: { initialAmount: true },
        _count: true,
      }),
      prisma.debt.aggregate({
        where: {
          organizationId,
          status: { in: [DEBT_STATUS.ACTIVE, DEBT_STATUS.PARTIALLY_PAID] },
        },
        _sum: { remainingAmount: true },
        _count: true,
      }),
      prisma.debt.count({
        where: { organizationId, status: DEBT_STATUS.OVERDUE },
      }),
      prisma.debt.aggregate({
        where: { organizationId, status: DEBT_STATUS.PAID },
        _sum: { initialAmount: true },
        _count: true,
      }),
      prisma.repayment.aggregate({
        where: {
          debt: { organizationId },
          paymentDate: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.organizationWallet.findUnique({
        where: { organizationId },
        select: {
          currentBalance: true,
          totalIncome: true,
          currency: true,
        },
      }),
    ]);

    const totalRepaid =
      (totalDebts._sum.initialAmount || 0) -
      (activeDebts._sum.remainingAmount || 0);

    return {
      summary: {
        totalDebts: totalDebts._count,
        totalAmount: totalDebts._sum.initialAmount || 0,
        activeDebts: activeDebts._count,
        activeAmount: activeDebts._sum.remainingAmount || 0,
        overdueDebts,
        paidDebts: paidDebts._count,
        paidAmount: paidDebts._sum.initialAmount || 0,
        totalRepaid,
        recentRepayments: recentRepayments._count,
        recentRepaidAmount: recentRepayments._sum.amount || 0,
      },
      percentages: {
        repaymentRate: totalDebts._sum.initialAmount
          ? Math.round((totalRepaid / totalDebts._sum.initialAmount) * 100)
          : 0,
        overdueRate: totalDebts._count
          ? Math.round((overdueDebts / totalDebts._count) * 100)
          : 0,
      },
      wallet: {
        currentBalance: wallet?.currentBalance || 0,
        totalIncome: wallet?.totalIncome || 0,
        currency: wallet?.currency || "XOF",
      },
    };
  }
}
