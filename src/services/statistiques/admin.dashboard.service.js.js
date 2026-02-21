import { prisma } from "../../config/database.js";

export default class AdminDashboardService {
  constructor() {}

  async getDashboardData(organizationId) {
    const [
      activeMembers,
      totalCollected,
      pendingContributions,
      activeDebts,
      overdueContributions,
      walletOverview, // ✅ NOUVEAU
      expensesOverview, // ✅ NOUVEAU
      financialSummary,
      paymentMethodsDistribution,
      monthlyRevenue,
      monthlyExpenses, // ✅ NOUVEAU
      memberStatusDistribution,
      subscriptionInfo,
    ] = await Promise.all([
      this.#getActiveMembersCount(organizationId),
      this.#getTotalCollected(organizationId),
      this.#getPendingContributions(organizationId),
      this.#getActiveDebts(organizationId),
      this.#getOverdueContributions(organizationId),
      this.#getWalletOverview(organizationId), // ✅ NOUVEAU
      this.#getExpensesOverview(organizationId), // ✅ NOUVEAU
      this.#getFinancialSummary(organizationId),
      this.#getPaymentMethodsDistribution(organizationId),
      this.#getMonthlyRevenue(organizationId),
      this.#getMonthlyExpenses(organizationId), // ✅ NOUVEAU
      this.#getMemberStatusDistribution(organizationId),
      this.#getSubscriptionInfo(organizationId),
    ]);

    return {
      role: "ADMIN",
      organizationId,
      generatedAt: new Date(),
      
      kpis: {
        activeMembers,
        totalCollected,
        pendingContributions,
        activeDebts,
        overdueContributions,
      },

      financialOverview: {
        wallet: walletOverview, // ✅ NOUVEAU
        summary: financialSummary,
        paymentMethods: paymentMethodsDistribution,
        expenses: expensesOverview, // ✅ NOUVEAU
      },

      charts: {
        monthlyRevenue,
        monthlyExpenses, // ✅ NOUVEAU
        paymentMethods: paymentMethodsDistribution,
        memberStatus: memberStatusDistribution,
      },

      subscription: subscriptionInfo,
      recentActivities: await this.#getRecentActivities(organizationId),
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
    };
  }

  // ======================================================
  // ✅ NOUVELLES MÉTHODES EXPENSES
  // ======================================================

  async #getExpensesOverview(organizationId) {
    const [pending, approved, paid, total, byCategory] = await Promise.all([
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
        where: { organizationId, status: { not: "CANCELLED" } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.expense.groupBy({
        by: ["category"],
        where: { organizationId, status: "PAID" },
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    return {
      pending: { count: pending._count, amount: pending._sum.amount || 0 },
      approved: { count: approved._count, amount: approved._sum.amount || 0 },
      paid: { count: paid._count, amount: paid._sum.amount || 0 },
      total: { count: total._count, amount: total._sum.amount || 0 },
      byCategory: byCategory.map((c) => ({
        category: c.category,
        label: this.#getCategoryLabel(c.category),
        amount: c._sum.amount || 0,
        count: c._count.id,
      })),
    };
  }

  async #getMonthlyExpenses(organizationId, months = 6) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const expenses = await prisma.expense.findMany({
      where: {
        organizationId,
        status: "PAID",
        expenseDate: { gte: startDate, lte: endDate },
      },
      select: { amount: true, expenseDate: true },
    });

    const monthlyData = {};
    expenses.forEach((expense) => {
      const monthKey = expense.expenseDate.toISOString().slice(0, 7);
      monthlyData[monthKey] = (monthlyData[monthKey] || 0) + expense.amount;
    });

    return Object.entries(monthlyData)
      .map(([month, amount]) => ({
        month,
        amount,
        label: new Date(month + "-01").toLocaleDateString("fr-FR", {
          month: "long",
          year: "numeric",
        }),
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  // ======================================================
  // MÉTHODES EXISTANTES (mises à jour)
  // ======================================================

  async #getActiveMembersCount(organizationId) {
    const count = await prisma.membership.count({
      where: { organizationId, status: "ACTIVE" },
    });

    return {
      value: count,
      label: "Membres actifs",
      icon: "👥",
      trend: await this.#getMemberTrend(organizationId),
    };
  }

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

  async #getFinancialSummary(organizationId) {
    const [expectedAmount, collectedAmount, remainingDebts, totalExpenses] =
      await Promise.all([
        prisma.contribution.aggregate({
          where: { organizationId },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: {
            organizationId,
            paymentStatus: "COMPLETED",
            type: { in: ["CONTRIBUTION", "DEBT_REPAYMENT"] },
          },
          _sum: { amount: true },
        }),
        prisma.debt.aggregate({
          where: {
            organizationId,
            status: { in: ["ACTIVE", "PARTIALLY_PAID"] },
          },
          _sum: { remainingAmount: true },
        }),
        prisma.expense.aggregate({
          where: { organizationId, status: "PAID" },
          _sum: { amount: true },
        }),
      ]);

    return {
      expectedAmount: expectedAmount._sum.amount || 0,
      collectedAmount: collectedAmount._sum.amount || 0,
      remainingAmount:
        (expectedAmount._sum.amount || 0) - (collectedAmount._sum.amount || 0),
      remainingDebts: remainingDebts._sum.remainingAmount || 0,
      totalExpenses: totalExpenses._sum.amount || 0,
      netBalance:
        (collectedAmount._sum.amount || 0) - (totalExpenses._sum.amount || 0),
    };
  }

  async #getPaymentMethodsDistribution(organizationId) {
    const result = await prisma.transaction.groupBy({
      by: ["paymentMethod"],
      where: { organizationId, paymentStatus: "COMPLETED" },
      _sum: { amount: true },
      _count: true,
    });

    const total = result.reduce(
      (sum, item) => sum + (item._sum.amount || 0),
      0
    );

    return result.map((item) => ({
      method: item.paymentMethod,
      name: this.#getPaymentMethodName(item.paymentMethod),
      amount: item._sum.amount || 0,
      count: item._count,
      percentage:
        total > 0 ? Math.round(((item._sum.amount || 0) / total) * 100) : 0,
    }));
  }

  async #getMonthlyRevenue(organizationId, months = 6) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const transactions = await prisma.transaction.findMany({
      where: {
        organizationId,
        paymentStatus: "COMPLETED",
        type: { in: ["CONTRIBUTION", "DEBT_REPAYMENT"] },
        createdAt: { gte: startDate, lte: endDate },
      },
      select: { amount: true, createdAt: true },
    });

    const monthlyData = {};
    transactions.forEach((transaction) => {
      const monthKey = transaction.createdAt.toISOString().slice(0, 7);
      monthlyData[monthKey] = (monthlyData[monthKey] || 0) + transaction.amount;
    });

    return Object.entries(monthlyData)
      .map(([month, amount]) => ({
        month,
        amount,
        label: new Date(month + "-01").toLocaleDateString("fr-FR", {
          month: "long",
          year: "numeric",
        }),
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  async #getMemberStatusDistribution(organizationId) {
    const result = await prisma.membership.groupBy({
      by: ["status"],
      where: { organizationId },
      _count: true,
    });

    return result.map((item) => ({
      status: item.status,
      count: item._count,
      label: this.#getStatusLabel(item.status),
    }));
  }

  async #getSubscriptionInfo(organizationId) {
    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
      include: {
        organization: { select: { name: true, currency: true } },
      },
    });

    if (!subscription) return null;

    const memberCount = await prisma.membership.count({
      where: { organizationId, status: "ACTIVE" },
    });

    return {
      plan: subscription.plan,
      status: subscription.status,
      maxMembers: subscription.maxMembers,
      currentUsage: memberCount,
      usagePercentage: Math.round(
        (memberCount / subscription.maxMembers) * 100
      ),
      price: subscription.price,
      currency: subscription.currency,
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      daysRemaining: subscription.endDate
        ? Math.ceil(
            (subscription.endDate.getTime() - new Date().getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : null,
    };
  }

  async #getRecentActivities(organizationId, limit = 10) {
    return await prisma.auditLog.findMany({
      where: {
        organizationId,
        OR: [
          { action: { contains: "PAYMENT" } },
          { action: { contains: "CONTRIBUTION" } },
          { action: { contains: "DEBT" } },
          { action: { contains: "EXPENSE" } },
          { action: { contains: "MEMBERSHIP" } },
        ],
      },
      include: {
        user: { select: { prenom: true, nom: true } },
        membership: {
          include: { user: { select: { prenom: true, nom: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async #getMemberTrend(organizationId) {
    const today = new Date();
    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const [currentCount, previousCount] = await Promise.all([
      prisma.membership.count({
        where: { organizationId, status: "ACTIVE", createdAt: { lte: today } },
      }),
      prisma.membership.count({
        where: {
          organizationId,
          status: "ACTIVE",
          createdAt: { lte: lastMonth },
        },
      }),
    ]);

    if (previousCount === 0) return 0;
    return Math.round(((currentCount - previousCount) / previousCount) * 100);
  }

  #getStatusLabel(status) {
    const labels = {
      ACTIVE: "Actif",
      INACTIVE: "Inactif",
      SUSPENDED: "Suspendu",
      PENDING: "En attente",
      PAID: "Payé",
      PARTIAL: "Partiel",
      OVERDUE: "En retard",
      CANCELLED: "Annulé",
    };
    return labels[status] || status;
  }

  #getPaymentMethodName(method) {
    const names = {
      CASH: "Espèces",
      MOBILE_MONEY: "Mobile Money",
      BANK_TRANSFER: "Virement",
      CHECK: "Chèque",
      CREDIT_CARD: "Carte bancaire",
    };
    return names[method] || method;
  }

  #getCategoryLabel(category) {
    const labels = {
      EVENT: "Événement",
      SOCIAL: "Social",
      ADMINISTRATIVE: "Administratif",
      MAINTENANCE: "Maintenance",
      DONATION: "Don",
      INVESTMENT: "Investissement",
      OPERATIONAL: "Opérationnel",
      OTHER: "Autre",
    };
    return labels[category] || category;
  }
}