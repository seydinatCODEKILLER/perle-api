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

  /**
   * ✅ Résoudre le montant selon le genre (avec support membres provisoires)
   */
  #resolveAmount(plan, membership) {
    // Récupérer le genre (User ou provisoire)
    const gender = membership.user?.gender || membership.provisionalGender;

    // Si le plan différencie par genre
    if (plan.differentiateByGender) {
      if (gender === "MALE" && plan.amountMale != null) {
        return plan.amountMale;
      }
      if (gender === "FEMALE" && plan.amountFemale != null) {
        return plan.amountFemale;
      }
    }

    // Montant par défaut
    if (plan.amount != null) {
      return plan.amount;
    }

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

    // 🔒 Protection métier contre les doublons
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

    // ✅ Récupérer TOUS les membres (avec et sans compte)
    const members = await prisma.membership.findMany({
      where: { 
        organizationId, 
        status: "ACTIVE" 
      },
      include: {
        user: {
          select: { 
            gender: true,
            prenom: true,
            nom: true,
          },
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

      // ✅ Créer les cotisations pour tous les membres
      const contributionsData = members.map((member) => ({
        membershipId: member.id,
        contributionPlanId: planId,
        organizationId,
        amount: this.#resolveAmount(plan, member),
        dueDate,
        status: "PENDING",
      }));

      const result = await tx.contribution.createMany({
        data: contributionsData,
      });

      // 🧾 Audit avec détails sur les membres provisoires
      const provisionalCount = members.filter(m => !m.userId).length;
      
      await tx.auditLog.create({
        data: {
          action: "GENERATE_CONTRIBUTIONS",
          resource: "contribution_plan",
          resourceId: planId,
          userId,
          organizationId,
          membershipId: admin.id,
          details: JSON.stringify({
            generatedCount: result.count,
            periodFrom: period.from,
            periodTo: period.to,
            dueDate,
            force,
            totalMembers: members.length,
            provisionalMembers: provisionalCount,
            withAccount: members.length - provisionalCount,
          }),
        },
      });

      return {
        generated: result.count,
        dueDate,
        period,
        stats: {
          total: members.length,
          provisional: provisionalCount,
          withAccount: members.length - provisionalCount,
        },
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

    // ✅ Inclure les données provisoires
    const member = await prisma.membership.findUnique({
      where: { id: membershipId },
      include: { 
        user: { 
          select: { 
            gender: true,
            prenom: true,
            nom: true,
          } 
        } 
      },
    });

    if (!member || member.organizationId !== organizationId) {
      throw new Error("Membre non trouvé");
    }

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

    const dueDate = this.#calculateDueDate(plan.frequency);
    const period = this.#getMonthRange(dueDate);

    // ✅ Vérifier si cotisation existe déjà
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
      throw new Error("Cotisation déjà existante pour ce membre sur cette période");
    }

    // ✅ Créer la cotisation avec le bon montant selon le genre
    const contribution = await prisma.contribution.create({
      data: {
        membershipId,
        contributionPlanId: planId,
        organizationId,
        amount: this.#resolveAmount(plan, member),
        dueDate,
        status: "PENDING",
      },
      include: {
        membership: {
          include: {
            user: {
              select: {
                prenom: true,
                nom: true,
                gender: true,
              },
            },
          },
        },
        contributionPlan: {
          select: {
            name: true,
            frequency: true,
          },
        },
      },
    });

    // ✅ Audit avec info sur membre provisoire
    await prisma.auditLog.create({
      data: {
        action: "ASSIGN_CONTRIBUTION",
        resource: "contribution",
        resourceId: contribution.id,
        userId,
        organizationId,
        membershipId: admin.id,
        details: JSON.stringify({
          membershipId,
          planId,
          amount: contribution.amount,
          dueDate,
          isProvisional: !member.userId,
          memberName: member.userId 
            ? `${member.user?.prenom} ${member.user?.nom}`
            : `${member.provisionalFirstName} ${member.provisionalLastName}`,
        }),
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

    const contribution = await prisma.contribution.findUnique({
      where: { id: contributionId },
      include: {
        membership: {
          include: {
            user: {
              select: { prenom: true, nom: true },
            },
          },
        },
      },
    });

    if (!contribution || contribution.organizationId !== organizationId) {
      throw new Error("Cotisation non trouvée");
    }

    const updated = await prisma.contribution.update({
      where: { id: contributionId },
      data: { status },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE_CONTRIBUTION_STATUS",
        resource: "contribution",
        resourceId: contributionId,
        userId,
        organizationId,
        membershipId: admin.id,
        details: JSON.stringify({ 
          oldStatus: contribution.status,
          newStatus: status,
          isProvisional: !contribution.membership.userId,
        }),
      },
    });

    return updated;
  }
}