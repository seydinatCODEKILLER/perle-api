import { prisma } from "../config/database.js";

export default class ContributionPlanService {
  /* ------------------------------------------------------------------ */
  /* Utils                                                              */
  /* ------------------------------------------------------------------ */

  async #requireMembership(userId, organizationId, roles = []) {
    const where = {
      userId,
      organizationId,
      status: "ACTIVE",
      ...(roles.length && { role: { in: roles } }),
    };

    const membership = await prisma.membership.findFirst({ where });

    if (!membership) {
      throw new Error("Accès non autorisé");
    }

    return membership;
  }

  #safeFloat(value) {
    return value !== undefined ? parseFloat(value) : undefined;
  }

  #safeDate(value) {
    return value !== undefined ? new Date(value) : undefined;
  }

  #getMonthRange(date) {
    return {
      gte: new Date(date.getFullYear(), date.getMonth(), 1),
      lt: new Date(date.getFullYear(), date.getMonth() + 1, 1),
    };
  }

  /* ------------------------------------------------------------------ */
  /* Plans                                                              */
  /* ------------------------------------------------------------------ */

  async createContributionPlan(organizationId, userId, planData) {
    const membership = await this.#requireMembership(
      userId,
      organizationId,
      ["ADMIN", "FINANCIAL_MANAGER"]
    );

    const plan = await prisma.contributionPlan.create({
      data: {
        ...planData,
        amount: this.#safeFloat(planData.amount),
        startDate: this.#safeDate(planData.startDate),
        endDate: planData.endDate ? this.#safeDate(planData.endDate) : null,
        organizationId,
      },
      include: { organization: { select: { id: true, name: true } } },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE_CONTRIBUTION_PLAN",
        resource: "contribution_plan",
        resourceId: plan.id,
        userId,
        organizationId,
        membershipId: membership.id,
        details: JSON.stringify({
          name: plan.name,
          amount: plan.amount,
          frequency: plan.frequency,
        }),
      },
    });

    return plan;
  }

  async getContributionPlanById(organizationId, planId, userId) {
    await this.#requireMembership(userId, organizationId);

    const plan = await prisma.contributionPlan.findFirst({
      where: { id: planId, organizationId },
      include: {
        organization: { select: { id: true, name: true } },
        _count: { select: { contributions: true } },
      },
    });

    if (!plan) throw new Error("Plan de cotisation non trouvé");

    return plan;
  }

  async getOrganizationContributionPlans(organizationId, userId, filters = {}) {
    await this.#requireMembership(userId, organizationId);

    const { isActive, search, page = 1, limit = 10 } = filters;
    const skip = (page - 1) * limit;

    const where = {
      organizationId,
      ...(isActive !== undefined && { isActive: isActive === "true" }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [plans, total] = await Promise.all([
      prisma.contributionPlan.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: {
              contributions: {
                where: { status: { in: ["PAID", "PARTIAL"] } },
              },
            },
          },
        },
      }),
      prisma.contributionPlan.count({ where }),
    ]);

    return {
      plans,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async updateContributionPlan(organizationId, planId, userId, updateData) {
    const membership = await this.#requireMembership(
      userId,
      organizationId,
      ["ADMIN", "FINANCIAL_MANAGER"]
    );

    const plan = await prisma.contributionPlan.findFirst({
      where: { id: planId, organizationId },
    });

    if (!plan) throw new Error("Plan non trouvé");

    const data = {
      ...updateData,
      ...(updateData.amount !== undefined && {
        amount: this.#safeFloat(updateData.amount),
      }),
      ...(updateData.startDate !== undefined && {
        startDate: this.#safeDate(updateData.startDate),
      }),
      ...(updateData.endDate !== undefined && {
        endDate: updateData.endDate
          ? this.#safeDate(updateData.endDate)
          : null,
      }),
    };

    const updated = await prisma.contributionPlan.update({
      where: { id: planId },
      data,
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE_CONTRIBUTION_PLAN",
        resource: "contribution_plan",
        resourceId: planId,
        userId,
        organizationId,
        membershipId: membership.id,
        details: JSON.stringify(data),
      },
    });

    return updated;
  }

  async toggleContributionPlanStatus(organizationId, planId, userId) {
    const membership = await this.#requireMembership(
      userId,
      organizationId,
      ["ADMIN", "FINANCIAL_MANAGER"]
    );

    const plan = await prisma.contributionPlan.findFirst({
      where: { id: planId, organizationId },
    });

    if (!plan) throw new Error("Plan non trouvé");

    const updated = await prisma.contributionPlan.update({
      where: { id: planId },
      data: { isActive: !plan.isActive },
    });

    await prisma.auditLog.create({
      data: {
        action: updated.isActive
          ? "ACTIVATE_CONTRIBUTION_PLAN"
          : "DEACTIVATE_CONTRIBUTION_PLAN",
        resource: "contribution_plan",
        resourceId: planId,
        userId,
        organizationId,
        membershipId: membership.id,
        details: JSON.stringify({ isActive: updated.isActive }),
      },
    });

    return updated;
  }

  /* ------------------------------------------------------------------ */
  /* Cotisations                                                         */
  /* ------------------------------------------------------------------ */

  async generateContributionsForPlan(organizationId, planId, userId, options = {}) {
    const membership = await this.#requireMembership(
      userId,
      organizationId,
      ["ADMIN", "FINANCIAL_MANAGER"]
    );

    const plan = await prisma.contributionPlan.findFirst({
      where: { id: planId, organizationId, isActive: true },
    });

    if (!plan) throw new Error("Plan invalide ou inactif");

    const dueDate = this.#calculateDueDate(plan.frequency, options.dueDateOffset);
    const period = this.#getMonthRange(dueDate);

    const existing = await prisma.contribution.count({
      where: {
        contributionPlanId: planId,
        dueDate: period,
      },
    });

    if (existing > 0 && !options.force) {
      throw new Error("Cotisations déjà générées pour cette période");
    }

    const members = await prisma.membership.findMany({
      where: { organizationId, status: "ACTIVE" },
      select: { id: true },
    });

    const contributions = await Promise.all(
      members.map((m) =>
        prisma.contribution.create({
          data: {
            membershipId: m.id,
            contributionPlanId: planId,
            organizationId,
            amount: plan.amount,
            dueDate,
            status: "PENDING",
          },
        })
      )
    );

    await prisma.auditLog.create({
      data: {
        action: "GENERATE_CONTRIBUTIONS",
        resource: "contribution_plan",
        resourceId: planId,
        userId,
        organizationId,
        membershipId: membership.id,
        details: JSON.stringify({
          generatedCount: contributions.length,
          force: !!options.force,
        }),
      },
    });

    return { success: true, generated: contributions.length };
  }

  async assignPlanToMember(organizationId, planId, membershipId, userId) {
    const membership = await this.#requireMembership(
      userId,
      organizationId,
      ["ADMIN", "FINANCIAL_MANAGER"]
    );

    const plan = await prisma.contributionPlan.findFirst({
      where: { id: planId, organizationId, isActive: true },
    });

    if (!plan) throw new Error("Plan invalide");

    const dueDate = this.#calculateDueDate(plan.frequency);
    const period = this.#getMonthRange(dueDate);

    const exists = await prisma.contribution.findFirst({
      where: {
        membershipId,
        contributionPlanId: planId,
        dueDate: period,
      },
    });

    if (exists) throw new Error("Cotisation déjà existante pour ce membre");

    const contribution = await prisma.contribution.create({
      data: {
        membershipId,
        contributionPlanId: planId,
        organizationId,
        amount: plan.amount,
        dueDate,
        status: "PENDING",
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "ASSIGN_PLAN_TO_MEMBER",
        resource: "contribution",
        resourceId: contribution.id,
        userId,
        organizationId,
        membershipId: membership.id,
        details: JSON.stringify({ membershipId, planId }),
      },
    });

    return contribution;
  }

  /* ------------------------------------------------------------------ */
  /* Dates                                                               */
  /* ------------------------------------------------------------------ */

  #calculateDueDate(frequency, offsetDays = 0) {
    const d = new Date();

    switch (frequency) {
      case "WEEKLY":
        d.setDate(d.getDate() + 7);
        break;
      case "MONTHLY":
        d.setMonth(d.getMonth() + 1);
        break;
      case "QUARTERLY":
        d.setMonth(d.getMonth() + 3);
        break;
      case "YEARLY":
        d.setFullYear(d.getFullYear() + 1);
        break;
      default:
        d.setDate(d.getDate() + 30);
    }

    d.setDate(d.getDate() + offsetDays);
    return d;
  }
}
