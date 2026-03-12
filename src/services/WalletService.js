import { prisma } from "../config/database.js";

export default class WalletService {

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
      include: {
        user: {
          select: {
            prenom: true,
            nom: true,
            email: true,
          },
        },
      },
    });

    if (!membership) {
      throw new Error("Accès non autorisé à cette organisation");
    }

    return membership;
  }

  async #checkFinancialPermission(membership) {
    if (!["ADMIN", "FINANCIAL_MANAGER"].includes(membership.role)) {
      throw new Error("Permissions financières insuffisantes");
    }
  }

  /* =======================
     💼 WALLET – CORE
  ======================== */

  async getOrCreateWallet(organizationId, currentUserId) {
    const membership = await this.#getActiveMembership(currentUserId, organizationId);

    let wallet = await prisma.organizationWallet.findUnique({
      where: { organizationId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            currency: true,
          },
        },
      },
    });

    if (wallet) return wallet;

    if (membership.role !== "ADMIN") {
      throw new Error("Seul un administrateur peut créer le portefeuille");
    }

    wallet = await prisma.$transaction(async (tx) => {
      const createdWallet = await tx.organizationWallet.create({
        data: {
          organizationId,
          initialBalance: 0,
          currentBalance: 0,
          totalIncome: 0,
          totalExpenses: 0,
          currency: "XOF",
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              currency: true,
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          userId: currentUserId,
          membershipId: membership.id,
          action: "CREATE_WALLET",
          resource: "OrganizationWallet",
          resourceId: createdWallet.id,
          details: {
            currency: createdWallet.currency,
          },
        },
      });

      return createdWallet;
    });

    return wallet;
  }

  async getWalletById(walletId, organizationId, currentUserId) {
    await this.#getActiveMembership(currentUserId, organizationId);

    const wallet = await prisma.organizationWallet.findFirst({
      where: {
        id: walletId,
        organizationId,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            currency: true,
          },
        },
      },
    });

    if (!wallet) {
      throw new Error("Portefeuille non trouvé");
    }

    return wallet;
  }

  /* =======================
     📊 STATISTIQUES SIMPLES (V1)
  ======================== */

  async getWalletStats(organizationId, currentUserId) {
    await this.#getActiveMembership(currentUserId, organizationId);

    const wallet = await this.getOrCreateWallet(organizationId, currentUserId);

    const [income, expenses] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          organizationId,
          paymentStatus: "COMPLETED",
          type: { not: "EXPENSE" },
        },
        _sum: { amount: true },
        _count: true,
      }),

      prisma.expense.aggregate({
        where: {
          organizationId,
          status: { not: "CANCELLED" },
        },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      wallet: {
        id: wallet.id,
        currency: wallet.currency,
        currentBalance: wallet.currentBalance,
        totalIncome: wallet.totalIncome,
        totalExpenses: wallet.totalExpenses,
      },
      stats: {
        incomeTotal: income._sum.amount || 0,
        incomeCount: income._count,
        expensesTotal: expenses._sum.amount || 0,
        expensesCount: expenses._count,
        netBalance:
          (income._sum.amount || 0) - (expenses._sum.amount || 0),
      },
    };
  }

  /* =======================
     🔄 RÉCONCILIATION
  ======================== */

  async reconcileWallet(
    organizationId,
    currentUserId,
    expectedBalance,
    note = ""
  ) {
    const membership = await this.#getActiveMembership(currentUserId, organizationId);
    await this.#checkFinancialPermission(membership);

    const wallet = await this.getOrCreateWallet(organizationId, currentUserId);
    const difference = expectedBalance - wallet.currentBalance;

    if (Math.abs(difference) < 0.01) {
      return {
        reconciled: true,
        message: "Aucune différence détectée",
        balance: wallet.currentBalance,
      };
    }

    return prisma.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          organizationId,
          membershipId: membership.id,
          type: difference > 0 ? "OTHER" : "EXPENSE",
          amount: Math.abs(difference),
          description: `Ajustement de réconciliation${note ? ` : ${note}` : ""}`,
          paymentMethod: "CASH",
          paymentStatus: "COMPLETED",
          metadata: {
            reconciliation: true,
            previousBalance: wallet.currentBalance,
            expectedBalance,
          },
        },
      });

      await tx.organizationWallet.update({
        where: { organizationId },
        data: {
          currentBalance: expectedBalance,
          ...(difference > 0
            ? { totalIncome: { increment: difference } }
            : { totalExpenses: { increment: Math.abs(difference) } }),
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          userId: currentUserId,
          membershipId: membership.id,
          action: "RECONCILE_WALLET",
          resource: "OrganizationWallet",
          resourceId: wallet.id,
          details: {
            previousBalance: wallet.currentBalance,
            newBalance: expectedBalance,
            difference,
            note,
          },
        },
      });

      return {
        reconciled: true,
        previousBalance: wallet.currentBalance,
        newBalance: expectedBalance,
        difference,
      };
    });
  }
}