import { prisma } from "../config/database.js";

export default class TransactionService {
  constructor() {}

  /* =======================
     🔐 MÉTHODES PRIVÉES
  ======================== */

  async #getActiveMembership(userId, organizationId) {
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

    return membership;
  }

  #buildDateFilter(startDate, endDate) {
    if (!startDate && !endDate) return undefined;

    return {
      ...(startDate && { gte: new Date(startDate) }),
      ...(endDate && { lte: new Date(endDate) }),
    };
  }

  /* =======================
     📄 LISTE DES TRANSACTIONS
  ======================== */

  async getTransactions(organizationId, currentUserId, filters = {}) {
    const {
      type,
      paymentMethod,
      paymentStatus,
      membershipId,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 10,
    } = filters;

    const skip = (page - 1) * limit;

    await this.#getActiveMembership(currentUserId, organizationId);

    const whereClause = {
      organizationId,
      ...(type && { type }),
      ...(paymentMethod && { paymentMethod }),
      ...(paymentStatus && { paymentStatus }),
      ...(membershipId && { membershipId }),
      ...(this.#buildDateFilter(startDate, endDate) && {
        createdAt: this.#buildDateFilter(startDate, endDate),
      }),
      ...(search && {
        OR: [
          { reference: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          {
            membership: {
              user: {
                OR: [
                  { prenom: { contains: search, mode: "insensitive" } },
                  { nom: { contains: search, mode: "insensitive" } },
                  { email: { contains: search, mode: "insensitive" } },
                  { phone: { contains: search, mode: "insensitive" } },
                ],
              },
            },
          },
        ],
      }),
    };

    const [transactions, total, totals] = await Promise.all([
      prisma.transaction.findMany({
        where: whereClause,
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
          organization: {
            select: { id: true, name: true },
          },
          wallet: {
            // ✅ AJOUT : Inclure le wallet lié
            select: {
              id: true,
              currentBalance: true,
              currency: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),

      prisma.transaction.count({ where: whereClause }),

      prisma.transaction.aggregate({
        where: whereClause,
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      transactions,
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
     🔍 TRANSACTION PAR ID
  ======================== */

  async getTransactionById(organizationId, transactionId, currentUserId) {
    await this.#getActiveMembership(currentUserId, organizationId);

    const transaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        organizationId,
      },
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
        organization: {
          select: {
            id: true,
            name: true,
            currency: true,
          },
        },
        wallet: {
          // ✅ AJOUT : Wallet lié
          select: {
            id: true,
            currentBalance: true,
            currency: true,
          },
        },
        contribution: {
          select: {
            id: true,
            amount: true,
            contributionPlan: { select: { name: true } },
          },
        },
        repayment: {
          select: {
            id: true,
            amount: true,
            debt: { select: { title: true } },
          },
        },
        expense: {
          // ✅ AJOUT : Dépense liée (si applicable)
          select: {
            id: true,
            title: true,
            category: true,
            status: true,
          },
        },
      },
    });

    if (!transaction) {
      throw new Error("Transaction non trouvée");
    }

    return transaction;
  }

  /* =======================
     🔎 RECHERCHE RAPIDE
  ======================== */

  async searchTransactions(organizationId, currentUserId, searchTerm) {
    await this.#getActiveMembership(currentUserId, organizationId);

    if (!searchTerm || searchTerm.trim().length < 2) {
      throw new Error(
        "Le terme de recherche doit contenir au moins 2 caractères",
      );
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        organizationId,
        OR: [
          { reference: { contains: searchTerm, mode: "insensitive" } },
          { description: { contains: searchTerm, mode: "insensitive" } },
          {
            membership: {
              user: {
                OR: [
                  { prenom: { contains: searchTerm, mode: "insensitive" } },
                  { nom: { contains: searchTerm, mode: "insensitive" } },
                  { email: { contains: searchTerm, mode: "insensitive" } },
                  { phone: { contains: searchTerm, mode: "insensitive" } },
                ],
              },
            },
          },
        ],
      },
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
        wallet: {
          // ✅ AJOUT
          select: {
            id: true,
            currentBalance: true,
            currency: true,
          },
        },
      },
      take: 50,
      orderBy: { createdAt: "desc" },
    });

    return {
      searchTerm,
      count: transactions.length,
      results: transactions,
    };
  }

  /* =======================
     👤 TRANSACTIONS D’UN MEMBRE
  ======================== */

  async getMemberTransactions(
    organizationId,
    membershipId,
    currentUserId,
    filters = {},
  ) {
    const {
      type,
      paymentMethod,
      paymentStatus,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = filters;

    const skip = (page - 1) * limit;

    const currentMembership = await this.#getActiveMembership(
      currentUserId,
      organizationId,
    );

    if (
      currentMembership.role !== "ADMIN" &&
      currentMembership.id !== membershipId
    ) {
      throw new Error("Permissions insuffisantes");
    }

    const whereClause = {
      organizationId,
      membershipId,
      ...(type && { type }),
      ...(paymentMethod && { paymentMethod }),
      ...(paymentStatus && { paymentStatus }),
      ...(this.#buildDateFilter(startDate, endDate) && {
        createdAt: this.#buildDateFilter(startDate, endDate),
      }),
    };

    const [transactions, total, totals] = await Promise.all([
      prisma.transaction.findMany({
        where: whereClause,
        include: {
          organization: {
            select: { id: true, name: true, currency: true },
          },
          wallet: {
            // ✅ AJOUT
            select: {
              id: true,
              currentBalance: true,
              currency: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),

      prisma.transaction.count({ where: whereClause }),

      prisma.transaction.aggregate({
        where: whereClause,
        _sum: { amount: true },
      }),
    ]);

    return {
      transactions,
      totals: {
        totalAmount: totals._sum.amount || 0,
        totalCount: total,
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getMyTransactions(organizationId, currentUserId, filters = {}) {
    const membership = await this.#getActiveMembership(
      currentUserId,
      organizationId,
    );

    return this.getMemberTransactions(
      organizationId,
      membership.id,
      currentUserId,
      filters,
    );
  }

  /* =======================
   ✅ VÉRIFICATION COHÉRENCE
======================== */

  async verifyWalletIntegrity(organizationId, currentUserId) {
    const membership = await this.#getActiveMembership(
      currentUserId,
      organizationId,
    );

    if (membership.role !== "ADMIN") {
      throw new Error(
        "Seul un administrateur peut vérifier la cohérence du wallet",
      );
    }

    // Récupérer le wallet
    const wallet = await prisma.organizationWallet.findUnique({
      where: { organizationId },
    });

    if (!wallet) {
      throw new Error("Wallet non trouvé");
    }

    // Calculer les totaux réels depuis les transactions
    const [income, expenses] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          organizationId,
          paymentStatus: "COMPLETED",
          type: { in: ["CONTRIBUTION", "DEBT_REPAYMENT", "DONATION", "OTHER"] },
        },
        _sum: { amount: true },
      }),

      prisma.expense.aggregate({
        where: {
          organizationId,
          status: { in: ["APPROVED", "PAID"] },
        },
        _sum: { amount: true },
      }),
    ]);

    const calculatedIncome = income._sum.amount || 0;
    const calculatedExpenses = expenses._sum.amount || 0;
    const calculatedBalance = calculatedIncome - calculatedExpenses;

    const isConsistent =
      Math.abs(wallet.currentBalance - calculatedBalance) < 0.01;

    return {
      wallet: {
        currentBalance: wallet.currentBalance,
        totalIncome: wallet.totalIncome,
        totalExpenses: wallet.totalExpenses,
      },
      calculated: {
        income: calculatedIncome,
        expenses: calculatedExpenses,
        balance: calculatedBalance,
      },
      isConsistent,
      discrepancy: wallet.currentBalance - calculatedBalance,
    };
  }

  /* =======================
   📊 STATISTIQUES PAR TYPE
======================== */

  async getTransactionStatsByType(organizationId, currentUserId, filters = {}) {
    await this.#getActiveMembership(currentUserId, organizationId);

    const { startDate, endDate } = filters;

    const whereClause = {
      organizationId,
      paymentStatus: "COMPLETED",
      ...(this.#buildDateFilter(startDate, endDate) && {
        createdAt: this.#buildDateFilter(startDate, endDate),
      }),
    };

    // Grouper par type de transaction
    const statsByType = await prisma.transaction.groupBy({
      by: ["type"],
      where: whereClause,
      _sum: {
        amount: true,
      },
      _count: {
        id: true,
      },
    });

    // Récupérer le wallet actuel
    const wallet = await prisma.organizationWallet.findUnique({
      where: { organizationId },
      select: {
        currentBalance: true,
        totalIncome: true,
        totalExpenses: true,
        currency: true,
      },
    });

    return {
      wallet,
      byType: statsByType.map((stat) => ({
        type: stat.type,
        totalAmount: stat._sum.amount || 0,
        count: stat._count.id,
      })),
      summary: {
        totalTransactions: statsByType.reduce((sum, s) => sum + s._count.id, 0),
        totalAmount: statsByType.reduce(
          (sum, s) => sum + (s._sum.amount || 0),
          0,
        ),
      },
    };
  }
}
