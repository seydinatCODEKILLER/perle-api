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
      throw new Error("Le terme de recherche doit contenir au moins 2 caractères");
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
    filters = {}
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
      organizationId
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
}
