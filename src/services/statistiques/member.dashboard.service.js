import { prisma } from "../../config/database.js";

export default class MemberDashboardService {
  constructor() {}

  async getDashboardData(organizationId, membershipId) {
    const [
      kpis,
      contributions,
      overdueContributions,
      upcomingContributions,
      personalDebts,
      recentPayments,
      recentRepayments,
      history,
      personalStats,
    ] = await Promise.all([
      // 🧩 1️⃣ KPIs PRINCIPAUX
      this.#getMemberKPIs(organizationId, membershipId),

      // 🧩 2️⃣ COTISATIONS DU MEMBRE
      this.#getActiveContributions(organizationId, membershipId),

      // 🧩 2️⃣ Cotisations en retard
      this.#getOverdueContributions(organizationId, membershipId),

      // 🧩 2️⃣ Cotisations à venir
      this.#getUpcomingContributions(organizationId, membershipId),

      // 🧩 3️⃣ DETTES PERSONNELLES
      this.#getPersonalDebts(organizationId, membershipId),

      // 🧩 4️⃣ Paiements récents
      this.#getRecentPayments(organizationId, membershipId),

      // 🧩 4️⃣ Remboursements récents
      this.#getRecentRepayments(organizationId, membershipId),

      // 🧩 5️⃣ HISTORIQUE
      this.#getPaymentHistory(organizationId, membershipId),

      // 🧩 6️⃣ STATISTIQUES PERSONNELLES
      this.#getPersonalStatistics(organizationId, membershipId),
    ]);

    // Informations personnelles du membre
    const memberInfo = await this.#getMemberInfo(membershipId);

    return {
      role: "MEMBER",
      organizationId,
      membershipId,
      generatedAt: new Date(),
      
      // 🧩 0️⃣ Informations personnelles
      memberInfo,

      // 🧩 1️⃣ KPIs PRINCIPAUX
      kpis,

      // 🧩 2️⃣ COTISATIONS DU MEMBRE
      contributions: {
        active: contributions,
        overdue: overdueContributions,
        upcoming: upcomingContributions,
      },

      // 🧩 3️⃣ DETTES PERSONNELLES
      debts: personalDebts,

      // 🧩 4️⃣ ACTIVITÉS RÉCENTES
      recentActivities: {
        payments: recentPayments,
        repayments: recentRepayments,
      },

      // 🧩 5️⃣ HISTORIQUE
      history,

      // 🧩 6️⃣ STATISTIQUES PERSONNELLES
      statistics: personalStats,
    };
  }

  // ======================================================
  // MÉTHODES PRIVÉES
  // ======================================================

  async #getMemberKPIs(organizationId, membershipId) {
    const [
      contributions,
      overdueAmount,
    ] = await Promise.all([
      // Total des cotisations (dues, payées, restantes)
      prisma.contribution.aggregate({
        where: { organizationId, membershipId },
        _sum: { amount: true, amountPaid: true },
      }),

      // Montant en retard
      prisma.contribution.aggregate({
        where: { 
          organizationId, 
          membershipId,
          status: "OVERDUE",
        },
        _sum: { amount: true, amountPaid: true },
      }),
    ]);

    const totalAmount = contributions._sum.amount || 0;
    const totalPaid = contributions._sum.amountPaid || 0;
    const totalRemaining = totalAmount - totalPaid;
    const overdueTotal = (overdueAmount._sum.amount || 0) - (overdueAmount._sum.amountPaid || 0);

    return {
      totalDue: totalAmount,
      totalPaid,
      totalRemaining,
      overdueAmount: overdueTotal,
    };
  }

  async #getActiveContributions(organizationId, membershipId, limit = 10) {
    const contributions = await prisma.contribution.findMany({
      where: {
        organizationId,
        membershipId,
        status: { in: ["PENDING", "PARTIAL"] },
      },
      include: {
        contributionPlan: {
          select: {
            name: true,
            frequency: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
      take: limit,
    });

    return contributions.map(contribution => ({
      id: contribution.id,
      planName: contribution.contributionPlan.name,
      amount: contribution.amount,
      amountPaid: contribution.amountPaid,
      remaining: contribution.amount - contribution.amountPaid,
      status: contribution.status,
      dueDate: contribution.dueDate,
      frequency: contribution.contributionPlan.frequency,
    }));
  }

  async #getOverdueContributions(organizationId, membershipId, limit = 10) {
    const today = new Date();
    const contributions = await prisma.contribution.findMany({
      where: {
        organizationId,
        membershipId,
        status: "OVERDUE",
        dueDate: { lt: today },
      },
      include: {
        contributionPlan: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { dueDate: 'desc' },
      take: limit,
    });

    return contributions.map(contribution => {
      const daysLate = Math.ceil(
        (today.getTime() - new Date(contribution.dueDate).getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        id: contribution.id,
        planName: contribution.contributionPlan.name,
        dueDate: contribution.dueDate,
        amount: contribution.amount,
        remaining: contribution.amount - contribution.amountPaid,
        daysLate,
        status: contribution.status,
      };
    });
  }

  async #getUpcomingContributions(organizationId, membershipId, limit = 5) {
    const today = new Date();
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const contributions = await prisma.contribution.findMany({
      where: {
        organizationId,
        membershipId,
        status: { in: ["PENDING", "PARTIAL"] },
        dueDate: {
          gte: today,
          lte: nextMonth,
        },
      },
      include: {
        contributionPlan: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
      take: limit,
    });

    return contributions.map(contribution => ({
      id: contribution.id,
      planName: contribution.contributionPlan.name,
      dueDate: contribution.dueDate,
      amount: contribution.amount,
      amountPaid: contribution.amountPaid,
      remaining: contribution.amount - contribution.amountPaid,
      daysUntilDue: Math.ceil(
        (new Date(contribution.dueDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      ),
    }));
  }

  async #getPersonalDebts(organizationId, membershipId) {
    const [
      debtsList,
      aggregates,
    ] = await Promise.all([
      // Liste des dettes
      prisma.debt.findMany({
        where: {
          organizationId,
          membershipId,
          status: { in: ["ACTIVE", "PARTIALLY_PAID"] },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),

      // Agrégats
      prisma.debt.aggregate({
        where: {
          organizationId,
          membershipId,
          status: { in: ["ACTIVE", "PARTIALLY_PAID"] },
        },
        _sum: { remainingAmount: true },
        _count: true,
      }),
    ]);

    return {
      list: debtsList.map(debt => ({
        id: debt.id,
        title: debt.title,
        initialAmount: debt.initialAmount,
        remainingAmount: debt.remainingAmount,
        status: debt.status,
        startDate: debt.createdAt,
        dueDate: debt.dueDate,
        percentagePaid: debt.initialAmount > 0 
          ? Math.round(((debt.initialAmount - debt.remainingAmount) / debt.initialAmount) * 100)
          : 0,
      })),
      aggregates: {
        activeDebtsCount: aggregates._count,
        totalDebtRemaining: aggregates._sum.remainingAmount || 0,
      },
    };
  }

  async #getRecentPayments(organizationId, membershipId, limit = 10) {
    const payments = await prisma.transaction.findMany({
      where: {
        organizationId,
        membershipId,
        paymentStatus: "COMPLETED",
        type: "CONTRIBUTION",
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return payments.map(payment => ({
      id: payment.id,
      amount: payment.amount,
      type: payment.type,
      paymentMethod: payment.paymentMethod,
      date: payment.createdAt,
      reference: payment.reference,
      description: payment.description,
    }));
  }

  async #getRecentRepayments(organizationId, membershipId, limit = 10) {
    const repayments = await prisma.repayment.findMany({
      where: {
        debt: {
          organizationId,
          membershipId,
        },
      },
      include: {
        debt: {
          select: {
            title: true,
          },
        },
      },
      orderBy: { paymentDate: 'desc' },
      take: limit,
    });

    return repayments.map(repayment => ({
      id: repayment.id,
      debtTitle: repayment.debt.title,
      amount: repayment.amount,
      date: repayment.paymentDate,
      paymentMethod: repayment.paymentMethod,
    }));
  }

  async #getPaymentHistory(organizationId, membershipId, limit = 20) {
    const [contributions, debts] = await Promise.all([
      // Historique des cotisations
      prisma.contribution.findMany({
        where: {
          organizationId,
          membershipId,
          status: { in: ["PAID", "CANCELLED"] },
        },
        include: {
          contributionPlan: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { paymentDate: 'desc' },
        take: Math.floor(limit / 2),
      }),

      // Historique des dettes
      prisma.debt.findMany({
        where: {
          organizationId,
          membershipId,
          status: "PAID",
        },
        orderBy: { updatedAt: 'desc' },
        take: Math.floor(limit / 2),
      }),
    ]);

    const history = [
      ...contributions.map(contribution => ({
        date: contribution.paymentDate || contribution.updatedAt,
        type: 'CONTRIBUTION',
        label: `Cotisation: ${contribution.contributionPlan.name}`,
        amount: contribution.amountPaid,
        status: contribution.status,
      })),
      ...debts.map(debt => ({
        date: debt.updatedAt,
        type: 'DEBT_SETTLEMENT',
        label: `Dette soldée: ${debt.title}`,
        amount: debt.initialAmount - debt.remainingAmount,
        status: 'PAID',
      })),
    ];

    // Trier par date décroissante et limiter
    return history
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, limit);
  }

  async #getPersonalStatistics(organizationId, membershipId) {
    const [
      transactions,
      paidContributions,
      averagePaymentDelay,
    ] = await Promise.all([
      // Transactions totales
      prisma.transaction.aggregate({
        where: {
          organizationId,
          membershipId,
          paymentStatus: "COMPLETED",
        },
        _count: true,
      }),

      // Cotisations payées pour calculer la régularité
      prisma.contribution.findMany({
        where: {
          organizationId,
          membershipId,
          status: "PAID",
          paymentDate: { not: null },
        },
        select: {
          dueDate: true,
          paymentDate: true,
        },
      }),

      // Délai de paiement moyen
      this.#calculateAveragePaymentDelay(organizationId, membershipId),
    ]);

    const totalTransactions = transactions._count;
    
    // Calculer le taux de régularité (paiements dans les délais)
    let onTimePayments = 0;
    paidContributions.forEach(contribution => {
      const dueDate = new Date(contribution.dueDate);
      const paymentDate = new Date(contribution.paymentDate);
      const daysDiff = Math.ceil((paymentDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff <= 7) { // Paiement dans les 7 jours suivant l'échéance
        onTimePayments++;
      }
    });

    const paymentRegularityRate = paidContributions.length > 0
      ? Math.round((onTimePayments / paidContributions.length) * 100)
      : 0;

    return {
      totalTransactions,
      averagePaymentDelay,
      paymentRegularityRate,
      totalContributions: paidContributions.length,
      onTimePayments,
      latePayments: paidContributions.length - onTimePayments,
    };
  }

  async #calculateAveragePaymentDelay(organizationId, membershipId) {
    const contributions = await prisma.contribution.findMany({
      where: {
        organizationId,
        membershipId,
        status: "PAID",
        paymentDate: { not: null },
      },
      select: {
        dueDate: true,
        paymentDate: true,
      },
      take: 50, // Limiter pour la performance
    });

    if (contributions.length === 0) return 0;

    const totalDays = contributions.reduce((sum, contribution) => {
      const dueDate = new Date(contribution.dueDate);
      const paymentDate = new Date(contribution.paymentDate);
      const daysDiff = Math.ceil((paymentDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      return sum + daysDiff;
    }, 0);

    return Math.round(totalDays / contributions.length);
  }

  async #getMemberInfo(membershipId) {
    const membership = await prisma.membership.findUnique({
      where: { id: membershipId },
      include: {
        user: {
          select: {
            prenom: true,
            nom: true,
            email: true,
            phone: true,
            avatar: true,
          },
        },
        profile: true,
      },
    });

    if (!membership) return null;

    return {
      memberNumber: membership.memberNumber,
      fullName: `${membership.user.prenom} ${membership.user.nom}`,
      email: membership.user.email,
      phone: membership.user.phone,
      avatar: membership.user.avatar,
      joinDate: membership.joinDate,
      status: membership.status,
      role: membership.role,
      profile: membership.profile,
    };
  }
}