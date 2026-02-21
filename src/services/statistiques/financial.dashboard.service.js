import { prisma } from "../../config/database.js";

export default class FinancialDashboardService {
  constructor() {}

  async getDashboardData(organizationId) {
    const [
      totalCollected,
      pendingContributions,
      activeDebts,
      overdueContributions,
      walletOverview, // ✅ NOUVEAU
      expensesOverview, // ✅ NOUVEAU
      todayRevenue,
      weekRevenue,
      todayExpenses, // ✅ NOUVEAU
      weekExpenses, // ✅ NOUVEAU
      remainingToCollect,
      debtsToRecover,
      pendingExpenses, // ✅ NOUVEAU
      recentPayments,
      recentRepayments,
      recentExpenses, // ✅ NOUVEAU
      revenueTrend,
      expenseTrend, // ✅ NOUVEAU
      debtsVsPaid,
    ] = await Promise.all([
      this.#getTotalCollected(organizationId),
      this.#getPendingContributions(organizationId),
      this.#getActiveDebts(organizationId),
      this.#getOverdueContributions(organizationId),
      this.#getWalletOverview(organizationId), // ✅ NOUVEAU
      this.#getExpensesOverview(organizationId), // ✅ NOUVEAU
      this.#getTodayRevenue(organizationId),
      this.#getWeekRevenue(organizationId),
      this.#getTodayExpenses(organizationId), // ✅ NOUVEAU
      this.#getWeekExpenses(organizationId), // ✅ NOUVEAU
      this.#getRemainingToCollect(organizationId),
      this.#getDebtsToRecover(organizationId),
      this.#getPendingExpenses(organizationId), // ✅ NOUVEAU
      this.#getRecentPayments(organizationId),
      this.#getRecentRepayments(organizationId),
      this.#getRecentExpenses(organizationId), // ✅ NOUVEAU
      this.#getRevenueTrend(organizationId),
      this.#getExpenseTrend(organizationId), // ✅ NOUVEAU
      this.#getDebtsVsPaid(organizationId),
    ]);

    return {
      role: "FINANCIAL_MANAGER",
      organizationId,
      generatedAt: new Date(),

      // 1️⃣ KPIs financiers
      kpis: {
        totalCollected,
        pendingContributions,
        activeDebts,
        overdueContributions,
      },

      // 2️⃣ Vue financière (Wallet + Expenses)
      financialOverview: {
        wallet: walletOverview, // ✅ NOUVEAU
        expenses: expensesOverview, // ✅ NOUVEAU
      },

      // 3️⃣ Focus exécution
      executionFocus: {
        todayRevenue,
        weekRevenue,
        todayExpenses, // ✅ NOUVEAU
        weekExpenses, // ✅ NOUVEAU
        remainingToCollect,
        debtsToRecover,
        pendingExpenses, // ✅ NOUVEAU
      },

      // 4️⃣ Activités récentes
      recentActivities: {
        payments: recentPayments,
        repayments: recentRepayments,
        expenses: recentExpenses, // ✅ NOUVEAU
      },

      // 5️⃣ Graphiques opérationnels
      charts: {
        revenueTrend,
        expenseTrend, // ✅ NOUVEAU
        debtsVsPaid,
      },

      // 6️⃣ Indicateurs de performance
      performance: {
        collectionRate: await this.#getCollectionRate(organizationId),
        debtRecoveryRate: await this.#getDebtRecoveryRate(organizationId),
        averagePaymentTime: await this.#getAveragePaymentTime(organizationId),
        expenseControlRate: await this.#getExpenseControlRate(organizationId), // ✅ NOUVEAU
      },
    };
  }

  // ======================================================
  // ✅ NOUVELLES MÉTHODES WALLET
  // ======================================================

  async #getWalletOverview(organizationId) {
    const wallet = await prisma.organizationWallet.findUnique({
      where: { organizationId },
    });

    if (!wallet) {
      return {
        exists: false,
        currentBalance: 0,
        totalIncome: 0,
        totalExpenses: 0,
        currency: "XOF",
      };
    }

    return {
      exists: true,
      id: wallet.id,
      currentBalance: wallet.currentBalance,
      totalIncome: wallet.totalIncome,
      totalExpenses: wallet.totalExpenses,
      currency: wallet.currency,
      lastUpdated: wallet.lastUpdated,
      netBalance: wallet.totalIncome - wallet.totalExpenses,
      healthStatus: this.#getWalletHealthStatus(
        wallet.currentBalance,
        wallet.totalIncome
      ),
    };
  }

  #getWalletHealthStatus(currentBalance, totalIncome) {
    if (totalIncome === 0) return "UNKNOWN";
    const ratio = (currentBalance / totalIncome) * 100;
    if (ratio >= 50) return "HEALTHY";
    if (ratio >= 25) return "WARNING";
    return "CRITICAL";
  }

  // ======================================================
  // ✅ NOUVELLES MÉTHODES EXPENSES
  // ======================================================

  async #getExpensesOverview(organizationId) {
    const [pending, approved, paid, rejected] = await Promise.all([
      prisma.expense.aggregate({
        where: { organizationId, status: "PENDING" },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.expense.aggregate({
        where: { organizationId, status: "APPROVED" },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.expense.aggregate({
        where: { organizationId, status: "PAID" },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.expense.aggregate({
        where: { organizationId, status: "REJECTED" },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      pending: { count: pending._count, amount: pending._sum.amount || 0 },
      approved: { count: approved._count, amount: approved._sum.amount || 0 },
      paid: { count: paid._count, amount: paid._sum.amount || 0 },
      rejected: { count: rejected._count, amount: rejected._sum.amount || 0 },
      totalPaid: paid._sum.amount || 0,
    };
  }

  async #getTodayExpenses(organizationId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = await prisma.expense.aggregate({
      where: {
        organizationId,
        status: "PAID",
        expenseDate: { gte: today, lt: tomorrow },
      },
      _sum: { amount: true },
      _count: true,
    });

    return {
      amount: result._sum.amount || 0,
      count: result._count,
      date: today,
    };
  }

  async #getWeekExpenses(organizationId) {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const result = await prisma.expense.aggregate({
      where: {
        organizationId,
        status: "PAID",
        expenseDate: { gte: weekAgo, lte: today },
      },
      _sum: { amount: true },
      _count: true,
    });

    return {
      amount: result._sum.amount || 0,
      count: result._count,
      period: { from: weekAgo, to: today },
    };
  }

  async #getPendingExpenses(organizationId) {
    const [pending, approved] = await Promise.all([
      prisma.expense.aggregate({
        where: { organizationId, status: "PENDING" },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.expense.aggregate({
        where: { organizationId, status: "APPROVED" },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      pending: {
        count: pending._count,
        amount: pending._sum.amount || 0,
      },
      approved: {
        count: approved._count,
        amount: approved._sum.amount || 0,
      },
      total: {
        count: pending._count + approved._count,
        amount: (pending._sum.amount || 0) + (approved._sum.amount || 0),
      },
    };
  }

  async #getRecentExpenses(organizationId, limit = 10) {
    return await prisma.expense.findMany({
      where: { organizationId },
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
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async #getExpenseTrend(organizationId, periods = 4) {
    const trends = [];
    const today = new Date();

    for (let i = 0; i < periods; i++) {
      const periodEnd = new Date(today);
      periodEnd.setDate(periodEnd.getDate() - i * 7);
      const periodStart = new Date(periodEnd);
      periodStart.setDate(periodStart.getDate() - 7);

      const result = await prisma.expense.aggregate({
        where: {
          organizationId,
          status: "PAID",
          expenseDate: { gte: periodStart, lt: periodEnd },
        },
        _sum: { amount: true },
        _count: true,
      });

      trends.unshift({
        period: `Semaine ${periods - i}`,
        startDate: periodStart,
        endDate: periodEnd,
        amount: result._sum.amount || 0,
        count: result._count,
      });
    }

    return trends;
  }

  async #getExpenseControlRate(organizationId) {
    const [total, approved, rejected] = await Promise.all([
      prisma.expense.count({
        where: { organizationId, status: { not: "PENDING" } },
      }),
      prisma.expense.count({
        where: { organizationId, status: { in: ["APPROVED", "PAID"] } },
      }),
      prisma.expense.count({
        where: { organizationId, status: "REJECTED" },
      }),
    ]);

    if (total === 0) return { approvalRate: 0, rejectionRate: 0 };

    return {
      approvalRate: Math.round((approved / total) * 100),
      rejectionRate: Math.round((rejected / total) * 100),
    };
  }

  // ======================================================
  // MÉTHODES EXISTANTES
  // ======================================================

  async #getTotalCollected(organizationId) {
    const result = await prisma.transaction.aggregate({
      where: {
        organizationId,
        paymentStatus: "COMPLETED",
        type: { in: ["CONTRIBUTION", "DEBT_REPAYMENT"] },
      },
      _sum: { amount: true },
    });

    return {
      value: result._sum.amount || 0,
      label: "Total collecté",
      icon: "💰",
      currency: "XOF",
    };
  }

  async #getPendingContributions(organizationId) {
    const count = await prisma.contribution.count({
      where: { organizationId, status: { in: ["PENDING", "PARTIAL"] } },
    });

    const amount = await prisma.contribution.aggregate({
      where: { organizationId, status: { in: ["PENDING", "PARTIAL"] } },
      _sum: { amount: true, amountPaid: true },
    });

    return {
      value: count,
      label: "Cotisations en attente",
      icon: "⏳",
      details: {
        count,
        totalAmount: amount._sum.amount || 0,
        totalPaid: amount._sum.amountPaid || 0,
        remaining: (amount._sum.amount || 0) - (amount._sum.amountPaid || 0),
      },
    };
  }

  async #getActiveDebts(organizationId) {
    const result = await prisma.debt.aggregate({
      where: {
        organizationId,
        status: { in: ["ACTIVE", "PARTIALLY_PAID"] },
      },
      _sum: { remainingAmount: true },
      _count: true,
    });

    return {
      value: result._count,
      label: "Dettes actives",
      icon: "⚠️",
      details: {
        count: result._count,
        totalRemaining: result._sum.remainingAmount || 0,
      },
    };
  }

  async #getOverdueContributions(organizationId) {
    const count = await prisma.contribution.count({
      where: { organizationId, status: "OVERDUE" },
    });

    const amount = await prisma.contribution.aggregate({
      where: { organizationId, status: "OVERDUE" },
      _sum: { amount: true, amountPaid: true },
    });

    return {
      value: count,
      label: "Cotisations en retard",
      icon: "📅",
      details: {
        count,
        totalAmount: amount._sum.amount || 0,
        totalPaid: amount._sum.amountPaid || 0,
        remaining: (amount._sum.amount || 0) - (amount._sum.amountPaid || 0),
      },
    };
  }

  async #getTodayRevenue(organizationId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = await prisma.transaction.aggregate({
      where: {
        organizationId,
        paymentStatus: "COMPLETED",
        type: { in: ["CONTRIBUTION", "DEBT_REPAYMENT"] },
        createdAt: { gte: today, lt: tomorrow },
      },
      _sum: { amount: true },
      _count: true,
    });

    return {
      amount: result._sum.amount || 0,
      count: result._count,
      date: today,
    };
  }

  async #getWeekRevenue(organizationId) {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const result = await prisma.transaction.aggregate({
      where: {
        organizationId,
        paymentStatus: "COMPLETED",
        type: { in: ["CONTRIBUTION", "DEBT_REPAYMENT"] },
        createdAt: { gte: weekAgo, lte: today },
      },
      _sum: { amount: true },
      _count: true,
    });

    return {
      amount: result._sum.amount || 0,
      count: result._count,
      period: { from: weekAgo, to: today },
    };
  }

  async #getRemainingToCollect(organizationId) {
    const result = await prisma.contribution.aggregate({
      where: { organizationId, status: { in: ["PENDING", "PARTIAL"] } },
      _sum: { amount: true, amountPaid: true },
    });

    const totalAmount = result._sum.amount || 0;
    const totalPaid = result._sum.amountPaid || 0;

    return {
      amount: totalAmount - totalPaid,
      details: {
        totalAmount,
        totalPaid,
        remaining: totalAmount - totalPaid,
      },
    };
  }

  async #getDebtsToRecover(organizationId) {
    const result = await prisma.debt.aggregate({
      where: {
        organizationId,
        status: { in: ["ACTIVE", "PARTIALLY_PAID", "OVERDUE"] },
      },
      _sum: { remainingAmount: true },
      _count: true,
    });

    return {
      amount: result._sum.remainingAmount || 0,
      count: result._count,
    };
  }

  async #getRecentPayments(organizationId, limit = 10) {
    return await prisma.transaction.findMany({
      where: {
        organizationId,
        paymentStatus: "COMPLETED",
        type: { in: ["CONTRIBUTION", "DEBT_REPAYMENT"] },
      },
      include: {
        membership: {
          include: {
            user: { select: { prenom: true, nom: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async #getRecentRepayments(organizationId, limit = 10) {
    return await prisma.repayment.findMany({
      where: { debt: { organizationId } },
      include: {
        debt: { select: { title: true } },
        transaction: true,
      },
      orderBy: { paymentDate: "desc" },
      take: limit,
    });
  }

  async #getRevenueTrend(organizationId, periods = 4) {
    const trends = [];
    const today = new Date();

    for (let i = 0; i < periods; i++) {
      const periodEnd = new Date(today);
      periodEnd.setDate(periodEnd.getDate() - i * 7);
      const periodStart = new Date(periodEnd);
      periodStart.setDate(periodStart.getDate() - 7);

      const result = await prisma.transaction.aggregate({
        where: {
          organizationId,
          paymentStatus: "COMPLETED",
          type: { in: ["CONTRIBUTION", "DEBT_REPAYMENT"] },
          createdAt: { gte: periodStart, lt: periodEnd },
        },
        _sum: { amount: true },
      });

      trends.unshift({
        period: `Semaine ${periods - i}`,
        startDate: periodStart,
        endDate: periodEnd,
        amount: result._sum.amount || 0,
      });
    }

    return trends;
  }

  async #getDebtsVsPaid(organizationId) {
    const [activeDebts, paidDebts] = await Promise.all([
      prisma.debt.aggregate({
        where: {
          organizationId,
          status: { in: ["ACTIVE", "PARTIALLY_PAID"] },
        },
        _sum: { remainingAmount: true },
        _count: true,
      }),
      prisma.debt.aggregate({
        where: { organizationId, status: "PAID" },
        _sum: { initialAmount: true },
        _count: true,
      }),
    ]);

    return {
      active: {
        count: activeDebts._count,
        amount: activeDebts._sum.remainingAmount || 0,
      },
      paid: {
        count: paidDebts._count,
        amount: paidDebts._sum.initialAmount || 0,
      },
    };
  }

  async #getCollectionRate(organizationId) {
    const [totalExpected, totalCollected] = await Promise.all([
      prisma.contribution.aggregate({
        where: { organizationId },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          organizationId,
          paymentStatus: "COMPLETED",
          type: "CONTRIBUTION",
        },
        _sum: { amount: true },
      }),
    ]);

    const expected = totalExpected._sum.amount || 0;
    const collected = totalCollected._sum.amount || 0;

    return expected > 0 ? Math.round((collected / expected) * 100) : 0;
  }

  async #getDebtRecoveryRate(organizationId) {
    const [totalDebts, recoveredDebts] = await Promise.all([
      prisma.debt.aggregate({
        where: { organizationId },
        _sum: { initialAmount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          organizationId,
          paymentStatus: "COMPLETED",
          type: "DEBT_REPAYMENT",
        },
        _sum: { amount: true },
      }),
    ]);

    const total = totalDebts._sum.initialAmount || 0;
    const recovered = recoveredDebts._sum.amount || 0;

    return total > 0 ? Math.round((recovered / total) * 100) : 0;
  }

  async #getAveragePaymentTime(organizationId) {
    const contributions = await prisma.contribution.findMany({
      where: {
        organizationId,
        status: "PAID",
        paymentDate: { not: null },
      },
      select: { dueDate: true, paymentDate: true },
      take: 100,
    });

    if (contributions.length === 0) return 0;

    const totalDays = contributions.reduce((sum, contribution) => {
      const dueDate = new Date(contribution.dueDate);
      const paymentDate = new Date(contribution.paymentDate);
      const daysDiff = Math.ceil(
        (paymentDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      return sum + daysDiff;
    }, 0);

    return Math.round(totalDays / contributions.length);
  }
}