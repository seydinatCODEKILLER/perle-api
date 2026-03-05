// services/ContributionPlanService.js

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

  /**
   * ✅ Convertir en float uniquement si la valeur est valide
   */
  #safeFloat(value) {
    if (value === null || value === undefined) return null;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }

  #safeDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  /* ======================================================
     GESTION DES PLANS
  ====================================================== */

  async createContributionPlan(organizationId, userId, planData) {
    const membership = await this.#requireMembership(userId, organizationId, [
      "ADMIN",
      "FINANCIAL_MANAGER",
    ]);

    // ✅ Préparer les données selon le mode
    const createData = {
      name: planData.name,
      description: planData.description || null,
      frequency: planData.frequency,
      differentiateByGender: planData.differentiateByGender || false,
      isActive: planData.isActive !== undefined ? planData.isActive : true,
      startDate: this.#safeDate(planData.startDate) || new Date(),
      endDate: this.#safeDate(planData.endDate),
      organizationId,
    };

    // ✅ Ajouter les montants selon le mode
    if (planData.differentiateByGender) {
      // Mode différencié : amountMale et amountFemale requis
      createData.amountMale = this.#safeFloat(planData.amountMale);
      createData.amountFemale = this.#safeFloat(planData.amountFemale);
      createData.amount = null; // ✅ amount à null
    } else {
      // Mode unique : amount requis
      createData.amount = this.#safeFloat(planData.amount);
      createData.amountMale = null; // ✅ montants genrés à null
      createData.amountFemale = null;
    }

    // ✅ Validation supplémentaire
    if (planData.differentiateByGender) {
      if (!createData.amountMale || createData.amountMale <= 0) {
        throw new Error("Le montant homme est requis et doit être positif");
      }
      if (!createData.amountFemale || createData.amountFemale <= 0) {
        throw new Error("Le montant femme est requis et doit être positif");
      }
    } else {
      if (!createData.amount || createData.amount <= 0) {
        throw new Error("Le montant est requis et doit être positif");
      }
    }

    const plan = await prisma.contributionPlan.create({
      data: createData,
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
          frequency: plan.frequency,
          differentiateByGender: plan.differentiateByGender,
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
        _count: {
          select: { contributions: true },
        },
        // ✅ AJOUT : Inclure les contributions avec les infos des membres
        contributions: {
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
                    avatar: true,
                    gender: true,
                  },
                },
              },
            },
          },
          orderBy: [
            { status: "asc" }, // PENDING, PAID, etc.
            { dueDate: "desc" },
          ],
        },
      },
    });

    if (!plan) throw new Error("Plan de cotisation non trouvé");

    // ✅ Enrichir chaque contribution avec displayInfo
    const enrichedContributions = plan.contributions.map((contribution) => {
      const displayInfo = this.#getMemberDisplayInfo(contribution.membership);

      return {
        ...contribution,
        membership: {
          ...contribution.membership,
          displayInfo,
        },
      };
    });

    return {
      ...plan,
      contributions: enrichedContributions,
    };
  }

  #getMemberDisplayInfo(membership) {
    if (!membership) return null;

    if (membership.userId && membership.user) {
      return {
        firstName: membership.user.prenom,
        lastName: membership.user.nom,
        email: membership.user.email,
        phone: membership.user.phone,
        avatar: membership.user.avatar,
        gender: membership.user.gender,
        hasAccount: true,
        isProvisional: false,
      };
    }

    return {
      firstName: membership.provisionalFirstName,
      lastName: membership.provisionalLastName,
      email: membership.provisionalEmail,
      phone: membership.provisionalPhone,
      avatar: membership.provisionalAvatar,
      gender: membership.provisionalGender,
      hasAccount: false,
      isProvisional: true,
    };
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
              contributions: true,
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
    const membership = await this.#requireMembership(userId, organizationId, [
      "ADMIN",
      "FINANCIAL_MANAGER",
    ]);

    const plan = await prisma.contributionPlan.findFirst({
      where: { id: planId, organizationId },
    });

    if (!plan) throw new Error("Plan non trouvé");

    // ✅ Préparer les données de mise à jour
    const updatePayload = {};

    if (updateData.name !== undefined) updatePayload.name = updateData.name;
    if (updateData.description !== undefined)
      updatePayload.description = updateData.description;
    if (updateData.frequency !== undefined)
      updatePayload.frequency = updateData.frequency;
    if (updateData.isActive !== undefined)
      updatePayload.isActive = updateData.isActive;
    if (updateData.startDate !== undefined)
      updatePayload.startDate = this.#safeDate(updateData.startDate);
    if (updateData.endDate !== undefined)
      updatePayload.endDate = this.#safeDate(updateData.endDate);

    // ✅ Gérer differentiateByGender
    if (updateData.differentiateByGender !== undefined) {
      updatePayload.differentiateByGender = updateData.differentiateByGender;

      if (updateData.differentiateByGender) {
        // Passer en mode différencié
        updatePayload.amountMale = this.#safeFloat(updateData.amountMale);
        updatePayload.amountFemale = this.#safeFloat(updateData.amountFemale);
        updatePayload.amount = null;
      } else {
        // Passer en mode unique
        updatePayload.amount = this.#safeFloat(updateData.amount);
        updatePayload.amountMale = null;
        updatePayload.amountFemale = null;
      }
    } else {
      // Garder le mode actuel et mettre à jour les montants si fournis
      if (plan.differentiateByGender) {
        if (updateData.amountMale !== undefined) {
          updatePayload.amountMale = this.#safeFloat(updateData.amountMale);
        }
        if (updateData.amountFemale !== undefined) {
          updatePayload.amountFemale = this.#safeFloat(updateData.amountFemale);
        }
      } else {
        if (updateData.amount !== undefined) {
          updatePayload.amount = this.#safeFloat(updateData.amount);
        }
      }
    }

    const updated = await prisma.contributionPlan.update({
      where: { id: planId },
      data: updatePayload,
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE_CONTRIBUTION_PLAN",
        resource: "contribution_plan",
        resourceId: planId,
        userId,
        organizationId,
        membershipId: membership.id,
        details: JSON.stringify({
          updatedFields: Object.keys(updatePayload),
        }),
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
        action: updated.isActive ? "ACTIVATE_PLAN" : "DEACTIVATE_PLAN",
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
