import { prisma } from "../../config/database.js";

export default class FinancialDashboardService {
  constructor() {}

  async getDashboardData(organizationId) {
    const [
      totalCollected,
      pendingContributions,
      activeDebts,
      overdueContributions,
      todayRevenue,
      weekRevenue,
      remainingToCollect,
      debtsToRecover,
      recentPayments,
      recentRepayments,
      revenueTrend,
      debtsVsPaid,
    ] = await Promise.all([
      // 💰 Total collecté
      this.#getTotalCollected(organizationId),

      // ⏳ Cotisations en attente
      this.#getPendingContributions(organizationId),

      // ⚠️ Dettes actives
      this.#getActiveDebts(organizationId),

      // 📅 Cotisations en retard
      this.#getOverdueContributions(organizationId),

      // 💵 Montant encaissé aujourd'hui
      this.#getTodayRevenue(organizationId),

      // 💵 Montant encaissé cette semaine
      this.#getWeekRevenue(organizationId),

      // 💵 Montant restant à collecter
      this.#getRemainingToCollect(organizationId),

      // 💵 Dettes à recouvrer
      this.#getDebtsToRecover(organizationId),

      // 💵 Derniers paiements
      this.#getRecentPayments(organizationId),

      // 💵 Remboursements récents
      this.#getRecentRepayments(organizationId),

      // 📈 Encaissements par période
      this.#getRevenueTrend(organizationId),

      // 📊 Dettes actives vs soldées
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

      // 2️⃣ Focus exécution
      executionFocus: {
        todayRevenue,
        weekRevenue,
        remainingToCollect,
        debtsToRecover,
      },

      // 3️⃣ Activités récentes
      recentActivities: {
        payments: recentPayments,
        repayments: recentRepayments,
      },

      // 4️⃣ Graphiques opérationnels
      charts: {
        revenueTrend,
        debtsVsPaid,
      },

      // 5️⃣ Indicateurs de performance
      performance: {
        collectionRate: await this.#getCollectionRate(organizationId),
        debtRecoveryRate: await this.#getDebtRecoveryRate(organizationId),
        averagePaymentTime: await this.#getAveragePaymentTime(organizationId),
      },
    };
  }

  // ======================================================
  // MÉTHODES PRIVÉES
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
      where: {
        organizationId,
        status: { in: ["PENDING", "PARTIAL"] },
      },
    });

    const amount = await prisma.contribution.aggregate({
      where: {
        organizationId,
        status: { in: ["PENDING", "PARTIAL"] },
      },
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
      where: {
        organizationId,
        status: "OVERDUE",
      },
    });

    const amount = await prisma.contribution.aggregate({
      where: {
        organizationId,
        status: "OVERDUE",
      },
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
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
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
        createdAt: {
          gte: weekAgo,
          lte: today,
        },
      },
      _sum: { amount: true },
      _count: true,
    });

    return {
      amount: result._sum.amount || 0,
      count: result._count,
      period: {
        from: weekAgo,
        to: today,
      },
    };
  }

  async #getRemainingToCollect(organizationId) {
    const result = await prisma.contribution.aggregate({
      where: {
        organizationId,
        status: { in: ["PENDING", "PARTIAL"] },
      },
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
            user: {
              select: {
                prenom: true,
                nom: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async #getRecentRepayments(organizationId, limit = 10) {
    return await prisma.repayment.findMany({
      where: {
        debt: {
          organizationId,
        },
      },
      include: {
        debt: {
          select: {
            title: true,
          },
        },
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
          createdAt: {
            gte: periodStart,
            lt: periodEnd,
          },
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
        where: {
          organizationId,
          status: "PAID",
        },
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
        paymentDate: {
          not: null,
        },
      },
      select: {
        dueDate: true,
        paymentDate: true,
      },
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
