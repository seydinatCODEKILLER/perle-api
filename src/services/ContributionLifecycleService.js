import { prisma } from "../config/database.js";

export default class ContributionLifecycleService {
  /* ======================================================
     UTILS & PERMISSIONS
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

  #getMonthRange(date) {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);

    return {
      gte: start,
      lt: end,
      from: start,
      to: end,
    };
  }

  #calculateDueDate(frequency, offsetDays = 0) {
    const d = new Date();

    const map = {
      WEEKLY: () => d.setDate(d.getDate() + 7),
      MONTHLY: () => d.setMonth(d.getMonth() + 1),
      QUARTERLY: () => d.setMonth(d.getMonth() + 3),
      YEARLY: () => d.setFullYear(d.getFullYear() + 1),
    };

    (map[frequency] || (() => d.setDate(d.getDate() + 30)))();
    d.setDate(d.getDate() + offsetDays);

    return d;
  }

  #resolveAmount(plan, gender) {
    if (gender === "MALE" && plan.amountMale != null) return plan.amountMale;
    if (gender === "FEMALE" && plan.amountFemale != null)
      return plan.amountFemale;
    if (plan.amount != null) return plan.amount;
    throw new Error("Aucun montant défini pour ce membre");
  }

  /* ======================================================
     GÉNÉRATION EN MASSE (MongoDB SAFE)
  ====================================================== */

  async generateForPlan(organizationId, planId, userId, options = {}) {
    const { force = false, dueDateOffset = 0 } = options;

    const admin = await this.#requireMembership(userId, organizationId, [
      "ADMIN",
      "FINANCIAL_MANAGER",
    ]);

    const plan = await prisma.contributionPlan.findFirst({
      where: {
        id: planId,
        organizationId,
        isActive: true,
      },
    });

    if (!plan) {
      throw new Error("Plan invalide ou inactif");
    }

    const dueDate = this.#calculateDueDate(plan.frequency, dueDateOffset);
    const period = this.#getMonthRange(dueDate);

    // 🔒 Protection métier contre les doublons (OBLIGATOIRE avec MongoDB)
    const existingCount = await prisma.contribution.count({
      where: {
        contributionPlanId: planId,
        organizationId,
        dueDate: {
          gte: period.gte,
          lt: period.lt,
        },
      },
    });

    if (existingCount > 0 && !force) {
      throw new Error("Cotisations déjà générées pour cette période");
    }

    const members = await prisma.membership.findMany({
      where: { organizationId, status: "ACTIVE" },
      select: {
        id: true,
        user: {
          select: { gender: true },
        },
      },
    });

    if (members.length === 0) {
      throw new Error("Aucun membre actif trouvé");
    }

    return prisma.$transaction(async (tx) => {
      // 🔥 Forcer = suppression puis recréation
      if (force && existingCount > 0) {
        await tx.contribution.deleteMany({
          where: {
            contributionPlanId: planId,
            organizationId,
            dueDate: {
              gte: period.gte,
              lt: period.lt,
            },
          },
        });
      }

      // ✅ createMany SANS skipDuplicates (MongoDB)
      const result = await tx.contribution.createMany({
        data: members.map((m) => ({
          membershipId: m.id,
          contributionPlanId: planId,
          organizationId,
          amount: this.#resolveAmount(plan, m.user?.gender),
          dueDate,
          status: "PENDING",
        })),
      });

      // 🧾 Audit
      await tx.auditLog.create({
        data: {
          action: "GENERATE",
          resource: "contribution_plan",
          resourceId: planId,
          userId,
          organizationId,
          membershipId: admin.id,
          details: {
            generatedCount: result.count,
            periodFrom: period.from,
            periodTo: period.to,
            dueDate,
            force,
          },
        },
      });

      return {
        generated: result.count,
        dueDate,
        period,
      };
    });
  }

  /* ======================================================
     ASSIGNATION INDIVIDUELLE
  ====================================================== */

  async assignPlanToMember(organizationId, planId, membershipId, userId) {
    const admin = await this.#requireMembership(userId, organizationId, [
      "ADMIN",
      "FINANCIAL_MANAGER",
    ]);

    const member = await prisma.membership.findUnique({
      where: { id: membershipId },
      include: { user: { select: { gender: true } } },
    });

    const plan = await prisma.contributionPlan.findFirst({
      where: {
        id: planId,
        organizationId,
        isActive: true,
      },
    });

    if (!plan) {
      throw new Error("Plan invalide");
    }

    const dueDate = this.#calculateDueDate(plan.frequency);
    const period = this.#getMonthRange(dueDate);

    const exists = await prisma.contribution.findFirst({
      where: {
        membershipId,
        contributionPlanId: planId,
        organizationId,
        dueDate: {
          gte: period.gte,
          lt: period.lt,
        },
      },
    });

    if (exists) {
      throw new Error("Cotisation déjà existante pour ce membre");
    }

    const contribution = await prisma.contribution.create({
      data: {
        membershipId,
        contributionPlanId: planId,
        organizationId,
        amount: this.#resolveAmount(plan, member.user?.gender),
        dueDate,
        status: "PENDING",
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "ASSIGN",
        resource: "contribution",
        resourceId: contribution.id,
        userId,
        organizationId,
        membershipId: admin.id,
      },
    });

    return contribution;
  }

  /* ======================================================
     MISE À JOUR DU STATUT
  ====================================================== */

  async updateContributionStatus(
    organizationId,
    contributionId,
    userId,
    status,
  ) {
    const admin = await this.#requireMembership(userId, organizationId, [
      "ADMIN",
      "FINANCIAL_MANAGER",
    ]);

    const allowedStatuses = [
      "PENDING",
      "PARTIAL",
      "PAID",
      "OVERDUE",
      "CANCELLED",
    ];

    if (!allowedStatuses.includes(status)) {
      throw new Error("Statut invalide");
    }

    const updated = await prisma.contribution.update({
      where: {
        id: contributionId,
      },
      data: {
        status,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE_STATUS",
        resource: "contribution",
        resourceId: contributionId,
        userId,
        organizationId,
        membershipId: admin.id,
        details: { status },
      },
    });

    return updated;
  }
}
