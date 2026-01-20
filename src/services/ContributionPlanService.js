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
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    
    return {
      from: start,
      to: end,
      gte: start,
      lt: end
    };
  }

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
        action: "CREATE",
        resource: "contribution_plan",
        resourceId: plan.id,
        userId,
        organizationId,
        membershipId: membership.id,
        details: JSON.stringify({
          name: plan.name,
          amount: plan.amount,
          frequency: plan.frequency,
          status: "CREATED"
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
        action: "UPDATE",
        resource: "contribution_plan",
        resourceId: planId,
        userId,
        organizationId,
        membershipId: membership.id,
        details: JSON.stringify({
          ...data,
          previousState: plan,
          updatedAt: new Date().toISOString()
        }),
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
        action: updated.isActive ? "ACTIVATE" : "DEACTIVATE",
        resource: "contribution_plan",
        resourceId: planId,
        userId,
        organizationId,
        membershipId: membership.id,
        details: JSON.stringify({
          isActive: updated.isActive,
          previousState: plan.isActive,
          changedAt: new Date().toISOString()
        }),
      },
    });

    return updated;
  }

  /* ------------------------------------------------------------------ */
  /* Cotisations                                                        */
  /* ------------------------------------------------------------------ */

  async generateContributionsForPlan(organizationId, planId, userId, options = {}) {
    const { force = false, dueDateOffset = 0 } = options;
    
    // 1️⃣ Vérification autorisation
    const membership = await this.#requireMembership(
      userId,
      organizationId,
      ["ADMIN", "FINANCIAL_MANAGER"]
    );

    // 2️⃣ Récupération plan actif
    const plan = await prisma.contributionPlan.findFirst({
      where: { 
        id: planId, 
        organizationId, 
        isActive: true 
      },
    });

    if (!plan) {
      throw new Error("Plan invalide ou inactif");
    }

    // 3️⃣ Calcul date & période
    const dueDate = this.#calculateDueDate(plan.frequency, dueDateOffset);
    const period = this.#getMonthRange(dueDate);

    // 4️⃣ Vérification doublons avec option force
    const existingCount = await prisma.contribution.count({
      where: {
        contributionPlanId: planId,
        dueDate: { gte: period.gte, lt: period.lt },
      },
    });

    if (existingCount > 0 && !force) {
      throw new Error(
        `Cotisations déjà générées pour la période ${period.from.toLocaleDateString()}. ` +
        `Utilisez force=true pour les regénérer.`
      );
    }

    // 5️⃣ Préparation des données membres
    const members = await prisma.membership.findMany({
      where: { 
        organizationId, 
        status: "ACTIVE" 
      },
      select: { 
        id: true,
        userId: true,
        role: true 
      },
    });

    if (members.length === 0) {
      throw new Error("Aucun membre actif trouvé dans l'organisation");
    }

    // 6️⃣ Transaction atomique pour toutes les opérations critiques
    const result = await prisma.$transaction(async (tx) => {
      // Suppression des anciennes cotisations si force = true
      if (force && existingCount > 0) {
        await tx.contribution.deleteMany({
          where: {
            contributionPlanId: planId,
            dueDate: { gte: period.gte, lt: period.lt },
          },
        });
      }

      // Préparation des données pour bulk insert
      const contributionsData = members.map((member) => ({
        membershipId: member.id,
        contributionPlanId: planId,
        organizationId,
        amount: plan.amount,
        dueDate,
        status: "PENDING",
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      // Insertion en masse avec gestion des doublons
      const created = await tx.contribution.createMany({
        data: contributionsData,
        skipDuplicates: true,
      });

      // Enregistrement d'audit détaillé
      await tx.auditLog.create({
        data: {
          action: "GENERATE",
          resource: "contribution_plan",
          resourceId: planId,
          userId,
          organizationId,
          membershipId: membership.id,
          details: JSON.stringify({
            planId,
            planName: plan.name,
            generatedCount: created.count,
            memberCount: members.length,
            force,
            dueDate: dueDate.toISOString(),
            period: {
              from: period.from.toISOString(),
              to: period.to.toISOString()
            },
            frequency: plan.frequency,
            amount: plan.amount,
            timestamp: new Date().toISOString()
          }),
        },
      });

      return {
        generatedCount: created.count,
        memberCount: members.length,
        period,
        dueDate
      };
    });

    // 7️⃣ Retour structuré
    return {
      success: true,
      generated: result.generatedCount,
      period: {
        from: result.period.from,
        to: result.period.to
      },
      dueDate: result.dueDate,
      memberCount: result.memberCount,
      message: `${result.generatedCount} cotisations générées pour ${result.memberCount} membres`
    };
  }

  async assignPlanToMember(organizationId, planId, membershipId, userId) {
    // 1️⃣ Vérification autorisation
    const adminMembership = await this.#requireMembership(
      userId,
      organizationId,
      ["ADMIN", "FINANCIAL_MANAGER"]
    );

    // 2️⃣ Vérification plan
    const plan = await prisma.contributionPlan.findFirst({
      where: { 
        id: planId, 
        organizationId, 
        isActive: true 
      },
    });

    if (!plan) {
      throw new Error("Plan invalide ou inactif");
    }

    // 3️⃣ Vérification membre
    const member = await prisma.membership.findFirst({
      where: { 
        id: membershipId, 
        organizationId, 
        status: "ACTIVE" 
      },
    });

    if (!member) {
      throw new Error("Membre non trouvé ou inactif");
    }

    // 4️⃣ Calcul date & période
    const dueDate = this.#calculateDueDate(plan.frequency);
    const period = this.#getMonthRange(dueDate);

    // 5️⃣ Vérification doublon
    const exists = await prisma.contribution.findFirst({
      where: {
        membershipId,
        contributionPlanId: planId,
        dueDate: { gte: period.gte, lt: period.lt },
      },
    });

    if (exists) {
      throw new Error("Cotisation déjà existante pour ce membre pour cette période");
    }

    // 6️⃣ Transaction atomique
    const result = await prisma.$transaction(async (tx) => {
      const contribution = await tx.contribution.create({
        data: {
          membershipId,
          contributionPlanId: planId,
          organizationId,
          amount: plan.amount,
          dueDate,
          status: "PENDING",
        },
      });

      await tx.auditLog.create({
        data: {
          action: "ASSIGN",
          resource: "contribution",
          resourceId: contribution.id,
          userId,
          organizationId,
          membershipId: adminMembership.id,
          details: JSON.stringify({
            contributionId: contribution.id,
            membershipId,
            memberUserId: member.userId,
            planId,
            planName: plan.name,
            amount: plan.amount,
            dueDate: dueDate.toISOString(),
            period: {
              from: period.from.toISOString(),
              to: period.to.toISOString()
            },
            assignedBy: userId,
            timestamp: new Date().toISOString()
          }),
        },
      });

      return contribution;
    });

    return result;
  }

  async getMemberContributions(organizationId, membershipId, userId, filters = {}) {
    // Vérifier que l'utilisateur a accès à ces données
    await this.#requireMembership(userId, organizationId);

    const { status, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where = {
      organizationId,
      membershipId,
      ...(status && { status }),
    };

    const [contributions, total] = await Promise.all([
      prisma.contribution.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dueDate: "desc" },
        include: {
          contributionPlan: {
            select: {
              id: true,
              name: true,
              frequency: true
            }
          }
        },
      }),
      prisma.contribution.count({ where }),
    ]);

    return {
      contributions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async updateContributionStatus(organizationId, contributionId, userId, status) {
    const membership = await this.#requireMembership(
      userId,
      organizationId,
      ["ADMIN", "FINANCIAL_MANAGER"]
    );

    const contribution = await prisma.contribution.findFirst({
      where: {
        id: contributionId,
        organizationId,
      },
      include: {
        membership: {
          select: { userId: true }
        }
      },
    });

    if (!contribution) {
      throw new Error("Cotisation non trouvée");
    }

    const validStatuses = ["PENDING", "PARTIAL", "PAID", "OVERDUE", "CANCELLED"];
    if (!validStatuses.includes(status)) {
      throw new Error("Statut invalide");
    }

    const updated = await prisma.contribution.update({
      where: { id: contributionId },
      data: { 
        status,
        updatedAt: new Date()
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE_STATUS",
        resource: "contribution",
        resourceId: contributionId,
        userId,
        organizationId,
        membershipId: membership.id,
        details: JSON.stringify({
          previousStatus: contribution.status,
          newStatus: status,
          contributionId,
          memberUserId: contribution.membership.userId,
          changedBy: userId,
          timestamp: new Date().toISOString()
        }),
      },
    });

    return updated;
  }
}