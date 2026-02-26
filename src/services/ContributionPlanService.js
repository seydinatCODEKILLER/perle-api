import { prisma } from "../config/database.js";

export default class ContributionPlanService {
  /* ======================================================
     PERMISSIONS & UTILS
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

  #safeFloat(value) {
    return value !== undefined ? parseFloat(value) : undefined;
  }

  #safeDate(value) {
    return value !== undefined ? new Date(value) : undefined;
  }

  /* ======================================================
     GESTION DES PLANS
  ====================================================== */

  async createContributionPlan(organizationId, userId, planData) {
    const membership = await this.#requireMembership(userId, organizationId, [
      "ADMIN",
      "FINANCIAL_MANAGER",
    ]);

    const plan = await prisma.contributionPlan.create({
      data: {
        ...planData,
        amount: this.#safeFloat(planData.amount),
        amountMale: planData.amountMale
          ? this.#safeFloat(planData.amountMale)
          : null,
        amountFemale: planData.amountFemale
          ? this.#safeFloat(planData.amountFemale)
          : null,
        startDate: this.#safeDate(planData.startDate),
        endDate: planData.endDate ? this.#safeDate(planData.endDate) : null,
        organizationId,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        resource: "contribution_plan",
        resourceId: plan.id,
        userId,
        organizationId,
        membershipId: membership.id,
      },
    });

    return plan;
  }

  async getContributionPlanById(organizationId, planId, userId) {
    await this.#requireMembership(userId, organizationId);

    const plan = await prisma.contributionPlan.findFirst({
      where: { id: planId, organizationId },
      include: {
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
    const membership = await this.#requireMembership(userId, organizationId, [
      "ADMIN",
      "FINANCIAL_MANAGER",
    ]);

    const updated = await prisma.contributionPlan.update({
      where: { id: planId },
      data: {
        ...updateData,
        ...(updateData.amount && {
          amount: this.#safeFloat(updateData.amount),
        }),
        ...(updateData.startDate && {
          startDate: this.#safeDate(updateData.startDate),
        }),
        ...(updateData.endDate !== undefined && {
          endDate: updateData.endDate
            ? this.#safeDate(updateData.endDate)
            : null,
        }),
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        resource: "contribution_plan",
        resourceId: planId,
        userId,
        organizationId,
        membershipId: membership.id,
      },
    });

    return updated;
  }

  async toggleContributionPlanStatus(organizationId, planId, userId) {
    const membership = await this.#requireMembership(userId, organizationId, [
      "ADMIN",
      "FINANCIAL_MANAGER",
    ]);

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
        action: updated.isActive ? "ACTIVATE" : "DEACTIVATE",
        resource: "contribution_plan",
        resourceId: planId,
        userId,
        organizationId,
        membershipId: membership.id,
      },
    });

    return updated;
  }
}
