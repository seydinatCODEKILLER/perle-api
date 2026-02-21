// services/expenseService.js
import { prisma } from "../config/database.js";

const ROLES = {
  ADMIN: "ADMIN",
  FINANCIAL_MANAGER: "FINANCIAL_MANAGER",
};

const EXPENSE_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  PAID: "PAID",
  CANCELLED: "CANCELLED",
};

export default class ExpenseService {
  /* =======================
     🔐 MÉTHODES PRIVÉES
  ======================== */

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
      throw new Error("Accès ou permissions insuffisantes");
    }

    return membership;
  }

  async #checkFinancialPermission(membership) {
    if (!["ADMIN", "FINANCIAL_MANAGER"].includes(membership.role)) {
      throw new Error("Permissions financières insuffisantes");
    }
  }

  async #getOrCreateWallet(organizationId) {
    let wallet = await prisma.organizationWallet.findUnique({
      where: { organizationId },
    });

    if (!wallet) {
      throw new Error("Wallet non trouvé. Contactez l'administrateur.");
    }

    return wallet;
  }

  /* =======================
     📝 CRÉER UNE DÉPENSE
  ======================== */

  async createExpense(organizationId, currentUserId, expenseData) {
    const membership = await this.#getActiveMembership(
      currentUserId,
      organizationId,
      [ROLES.ADMIN, ROLES.FINANCIAL_MANAGER],
    );

    const wallet = await this.#getOrCreateWallet(organizationId);

    const expense = await prisma.expense.create({
      data: {
        organizationId,
        walletId: wallet.id,
        createdById: membership.id,
        title: expenseData.title,
        description: expenseData.description,
        amount: Number(expenseData.amount),
        currency: wallet.currency,
        category: expenseData.category,
        status: "PENDING",
        expenseDate: expenseData.expenseDate
          ? new Date(expenseData.expenseDate)
          : new Date(),
      },
      include: {
        createdBy: {
          include: {
            user: {
              select: { prenom: true, nom: true },
            },
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE_EXPENSE",
        resource: "expense",
        resourceId: expense.id,
        userId: currentUserId,
        organizationId,
        membershipId: membership.id,
        details: {
          title: expense.title,
          amount: expense.amount,
          category: expense.category,
        },
      },
    });

    return expense;
  }

  /* =======================
     ✅ APPROUVER UNE DÉPENSE
  ======================== */

  async approveExpense(organizationId, expenseId, currentUserId) {
    const membership = await this.#getActiveMembership(
      currentUserId,
      organizationId,
      [ROLES.ADMIN],
    );

    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: { wallet: true },
    });

    if (!expense || expense.organizationId !== organizationId) {
      throw new Error("Dépense introuvable");
    }

    if (expense.status !== "PENDING") {
      throw new Error(`Impossible d'approuver une dépense ${expense.status}`);
    }

    const updatedExpense = await prisma.expense.update({
      where: { id: expenseId },
      data: {
        status: "APPROVED",
        approvedById: membership.id,
        approvedAt: new Date(),
      },
      include: {
        createdBy: {
          include: {
            user: { select: { prenom: true, nom: true } },
          },
        },
        approvedBy: {
          include: {
            user: { select: { prenom: true, nom: true } },
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "APPROVE_EXPENSE",
        resource: "expense",
        resourceId: expenseId,
        userId: currentUserId,
        organizationId,
        membershipId: membership.id,
        details: {
          title: expense.title,
          amount: expense.amount,
        },
      },
    });

    return updatedExpense;
  }

  /* =======================
     ❌ REJETER UNE DÉPENSE
  ======================== */

  async rejectExpense(organizationId, expenseId, currentUserId, reason = "") {
    const membership = await this.#getActiveMembership(
      currentUserId,
      organizationId,
      [ROLES.ADMIN],
    );

    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
    });

    if (!expense || expense.organizationId !== organizationId) {
      throw new Error("Dépense introuvable");
    }

    if (expense.status !== "PENDING") {
      throw new Error(`Impossible de rejeter une dépense ${expense.status}`);
    }

    const updatedExpense = await prisma.expense.update({
      where: { id: expenseId },
      data: {
        status: "REJECTED",
        approvedById: membership.id,
        approvedAt: new Date(),
      },
      include: {
        createdBy: {
          include: {
            user: { select: { prenom: true, nom: true } },
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "REJECT_EXPENSE",
        resource: "expense",
        resourceId: expenseId,
        userId: currentUserId,
        organizationId,
        membershipId: membership.id,
        details: {
          title: expense.title,
          amount: expense.amount,
          reason,
        },
      },
    });

    return updatedExpense;
  }

  /* =======================
     💰 PAYER UNE DÉPENSE (impact wallet)
  ======================== */

  async payExpense(organizationId, expenseId, currentUserId, paymentData) {
    const membership = await this.#getActiveMembership(
      currentUserId,
      organizationId,
      [ROLES.ADMIN, ROLES.FINANCIAL_MANAGER],
    );

    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: { wallet: true },
    });

    if (!expense || expense.organizationId !== organizationId) {
      throw new Error("Dépense introuvable");
    }

    if (expense.status !== "APPROVED") {
      throw new Error("Seules les dépenses approuvées peuvent être payées");
    }

    if (expense.status === "PAID") {
      throw new Error("Dépense déjà payée");
    }

    // Vérifier que le wallet a suffisamment de fonds
    if (expense.wallet.currentBalance < expense.amount) {
      throw new Error(
        `Solde insuffisant. Disponible: ${expense.wallet.currentBalance} ${expense.currency}, Requis: ${expense.amount} ${expense.currency}`
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Créer la transaction
      const transaction = await tx.transaction.create({
        data: {
          organizationId,
          membershipId: membership.id,
          walletId: expense.walletId,
          type: "EXPENSE",
          amount: expense.amount,
          currency: expense.currency,
          description: `Dépense: ${expense.title}`,
          paymentMethod: paymentData.paymentMethod,
          paymentStatus: "COMPLETED",
          reference: `EXP-${Date.now()}-${expenseId.slice(-6)}`,
          metadata: {
            expenseId,
            category: expense.category,
          },
        },
      });

      // 2. Mettre à jour la dépense
      const paidExpense = await tx.expense.update({
        where: { id: expenseId },
        data: {
          status: "PAID",
          transactionId: transaction.id,
        },
        include: {
          createdBy: {
            include: {
              user: { select: { prenom: true, nom: true } },
            },
          },
          transaction: true,
        },
      });

      // 3. Mettre à jour le wallet
      await tx.organizationWallet.update({
        where: { id: expense.walletId },
        data: {
          currentBalance: { decrement: expense.amount },
          totalExpenses: { increment: expense.amount },
        },
      });

      return paidExpense;
    });

    // Audit log avec impact financier
    await prisma.auditLog.create({
      data: {
        action: "PAY_EXPENSE",
        resource: "expense",
        resourceId: expenseId,
        userId: currentUserId,
        organizationId,
        membershipId: membership.id,
        financialImpact: -expense.amount,
        previousBalance: expense.wallet.currentBalance,
        newBalance: expense.wallet.currentBalance - expense.amount,
        details: {
          title: expense.title,
          amount: expense.amount,
          category: expense.category,
          paymentMethod: paymentData.paymentMethod,
        },
      },
    });

    return result;
  }

  /* =======================
     📋 LISTE DES DÉPENSES
  ======================== */

  async getExpenses(organizationId, currentUserId, filters = {}) {
    await this.#getActiveMembership(currentUserId, organizationId);

    const {
      status,
      category,
      createdById,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 10,
    } = filters;

    const skip = (page - 1) * limit;

    const where = {
      organizationId,
      ...(status && { status }),
      ...(category && { category }),
      ...(createdById && { createdById }),
      ...(startDate || endDate
        ? {
            expenseDate: {
              ...(startDate && { gte: new Date(startDate) }),
              ...(endDate && { lte: new Date(endDate) }),
            },
          }
        : {}),
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [expenses, total, totals] = await Promise.all([
      prisma.expense.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: {
            include: {
              user: { select: { prenom: true, nom: true } },
            },
          },
          approvedBy: {
            include: {
              user: { select: { prenom: true, nom: true } },
            },
          },
          transaction: true,
        },
      }),
      prisma.expense.count({ where }),
      prisma.expense.aggregate({
        where,
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      expenses,
      totals: {
        totalAmount: totals._sum.amount || 0,
        totalCount: totals._count,
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /* =======================
     🔍 DÉTAIL D'UNE DÉPENSE
  ======================== */

  async getExpenseById(organizationId, expenseId, currentUserId) {
    await this.#getActiveMembership(currentUserId, organizationId);

    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: {
        createdBy: {
          include: {
            user: { select: { prenom: true, nom: true, email: true } },
          },
        },
        approvedBy: {
          include: {
            user: { select: { prenom: true, nom: true, email: true } },
          },
        },
        transaction: true,
        wallet: {
          select: {
            currentBalance: true,
            currency: true,
          },
        },
      },
    });

    if (!expense || expense.organizationId !== organizationId) {
      throw new Error("Dépense introuvable");
    }

    return expense;
  }

  /* =======================
     📊 STATISTIQUES DES DÉPENSES
  ======================== */

  async getExpenseStats(organizationId, currentUserId, filters = {}) {
    await this.#getActiveMembership(currentUserId, organizationId);

    const { startDate, endDate } = filters;

    const where = {
      organizationId,
      ...(startDate || endDate
        ? {
            expenseDate: {
              ...(startDate && { gte: new Date(startDate) }),
              ...(endDate && { lte: new Date(endDate) }),
            },
          }
        : {}),
    };

    const [totalStats, byStatus, byCategory] = await Promise.all([
      // Stats globales
      prisma.expense.aggregate({
        where,
        _sum: { amount: true },
        _count: true,
      }),

      // Par statut
      prisma.expense.groupBy({
        by: ["status"],
        where,
        _sum: { amount: true },
        _count: { id: true },
      }),

      // Par catégorie
      prisma.expense.groupBy({
        by: ["category"],
        where,
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    return {
      total: {
        amount: totalStats._sum.amount || 0,
        count: totalStats._count,
      },
      byStatus: byStatus.map((s) => ({
        status: s.status,
        amount: s._sum.amount || 0,
        count: s._count.id,
      })),
      byCategory: byCategory.map((c) => ({
        category: c.category,
        amount: c._sum.amount || 0,
        count: c._count.id,
      })),
    };
  }

  /* =======================
     🗑️ ANNULER UNE DÉPENSE
  ======================== */

  async cancelExpense(organizationId, expenseId, currentUserId, reason = "") {
    const membership = await this.#getActiveMembership(
      currentUserId,
      organizationId,
      [ROLES.ADMIN],
    );

    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: { wallet: true },
    });

    if (!expense || expense.organizationId !== organizationId) {
      throw new Error("Dépense introuvable");
    }

    if (expense.status === "PAID") {
      throw new Error(
        "Impossible d'annuler une dépense déjà payée. Utilisez la réconciliation du wallet."
      );
    }

    const cancelledExpense = await prisma.expense.update({
      where: { id: expenseId },
      data: { status: "CANCELLED" },
    });

    await prisma.auditLog.create({
      data: {
        action: "CANCEL_EXPENSE",
        resource: "expense",
        resourceId: expenseId,
        userId: currentUserId,
        organizationId,
        membershipId: membership.id,
        details: {
          title: expense.title,
          amount: expense.amount,
          previousStatus: expense.status,
          reason,
        },
      },
    });

    return cancelledExpense;
  }
}