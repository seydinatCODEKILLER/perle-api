import { prisma } from "../config/database.js";

export default class SubscriptionService {
  constructor() {}

  /* =======================
     🔐 MÉTHODES PRIVÉES
  ======================== */

  async #getActiveMembership(userId, organizationId) {
    const membership = await prisma.membership.findFirst({
      where: { userId, organizationId, status: "ACTIVE" },
    });
    if (!membership) throw new Error("Accès non autorisé à cette organisation");
    return membership;
  }

  async #getAdminMembership(userId, organizationId) {
    const membership = await prisma.membership.findFirst({
      where: { userId, organizationId, status: "ACTIVE", role: "ADMIN" },
    });
    if (!membership) throw new Error("Permissions insuffisantes (ADMIN requis)");
    return membership;
  }

  async #getSubscription(organizationId) {
    let subscription = await prisma.subscription.findUnique({
      where: { organizationId },
    });
    if (!subscription) subscription = await this.#createDefaultSubscription(organizationId);
    return subscription;
  }

  #calculateEndDate(planName) {
    const endDate = new Date();
    if (planName === "FREE") endDate.setFullYear(endDate.getFullYear() + 1);
    else endDate.setMonth(endDate.getMonth() + 1);
    return endDate;
  }

  #getUsageRecommendations(usagePercentage) {
    const recommendations = [];
    if (usagePercentage >= 90)
      recommendations.push({
        type: "URGENT",
        message: "Approche de la limite de membres. Pensez à mettre à niveau.",
        action: "UPGRADE_PLAN",
      });
    else if (usagePercentage >= 75)
      recommendations.push({
        type: "WARNING",
        message: "Plus de 75% de la limite de membres utilisée.",
        action: "CONSIDER_UPGRADE",
      });
    return recommendations;
  }

  async #createDefaultSubscription(organizationId) {
    return await prisma.subscription.create({
      data: {
        organizationId,
        plan: "FREE",
        status: "ACTIVE",
        startDate: new Date(),
        maxMembers: 50,
        currentUsage: 0,
        price: 0,
        currency: "XOF",
      },
      include: { organization: { select: { id: true, name: true, currency: true } } },
    });
  }

  async #validatePlanChange(current, target) {
    if (current.plan === target.name) throw new Error(`Vous êtes déjà sur le plan ${target.displayName}`);
    if (typeof target.features.maxMembers === "number" && current.currentUsage > target.features.maxMembers)
      throw new Error(
        `Impossible de passer au plan ${target.displayName} : ${current.currentUsage} membres actuels, max ${target.features.maxMembers}.`
      );
  }

  /* =======================
     📄 MÉTHODES PUBLIQUES
  ======================== */

  async getOrganizationSubscription(organizationId, currentUserId) {
    await this.#getActiveMembership(currentUserId, organizationId);
    return await this.#getSubscription(organizationId);
  }

  async updateSubscription(organizationId, currentUserId, subscriptionData) {
    const adminMembership = await this.#getAdminMembership(currentUserId, organizationId);
    const existing = await this.#getSubscription(organizationId);

    const dataToUpdate = {
      ...subscriptionData,
      ...(subscriptionData.price && { price: parseFloat(subscriptionData.price) }),
      ...(subscriptionData.maxMembers && { maxMembers: parseInt(subscriptionData.maxMembers) }),
      ...(subscriptionData.startDate && { startDate: new Date(subscriptionData.startDate) }),
      ...(subscriptionData.endDate && { endDate: new Date(subscriptionData.endDate) }),
    };

    const updated = await prisma.subscription.update({
      where: { organizationId },
      data: dataToUpdate,
      include: { organization: { select: { id: true, name: true, currency: true } } },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE_SUBSCRIPTION",
        resource: "subscription",
        resourceId: updated.id,
        userId: currentUserId,
        organizationId,
        membershipId: adminMembership.id,
        details: JSON.stringify(dataToUpdate),
      },
    });

    return updated;
  }

  async updateSubscriptionStatus(organizationId, currentUserId, status) {
    const adminMembership = await this.#getAdminMembership(currentUserId, organizationId);
    const existing = await this.#getSubscription(organizationId);

    const validStatuses = ["ACTIVE", "INACTIVE", "SUSPENDED", "CANCELLED", "EXPIRED"];
    if (!validStatuses.includes(status)) throw new Error("Statut d'abonnement invalide");

    const updated = await prisma.subscription.update({
      where: { organizationId },
      data: { status },
      include: { organization: { select: { id: true, name: true, currency: true } } },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE_SUBSCRIPTION_STATUS",
        resource: "subscription",
        resourceId: updated.id,
        userId: currentUserId,
        organizationId,
        membershipId: adminMembership.id,
        details: JSON.stringify({ previousStatus: existing.status, newStatus: status }),
      },
    });

    return updated;
  }

  async checkSubscriptionLimits(organizationId, feature) {
    const subscription = await this.#getSubscription(organizationId);

    if (subscription.status !== "ACTIVE") throw new Error(`Abonnement ${subscription.status.toLowerCase()}`);
    if (subscription.endDate && subscription.endDate < new Date()) throw new Error("Abonnement expiré");

    if (feature === "MEMBERS" && subscription.currentUsage >= subscription.maxMembers)
      throw new Error(`Limite de membres atteinte (${subscription.maxMembers}). Mettez à niveau.`);

    return {
      hasAccess: true,
      subscription,
      limits: {
        maxMembers: subscription.maxMembers,
        currentUsage: subscription.currentUsage,
        remaining: subscription.maxMembers - subscription.currentUsage,
      },
    };
  }

  async getSubscriptionUsage(organizationId, currentUserId) {
    await this.#getActiveMembership(currentUserId, organizationId);
    const subscription = await this.#getSubscription(organizationId);

    const activeMembersCount = await prisma.membership.count({ where: { organizationId, status: "ACTIVE" } });
    const activePlansCount = await prisma.contributionPlan.count({ where: { organizationId, isActive: true } });

    const memberUsagePercentage = subscription.maxMembers > 0
      ? Math.round((activeMembersCount / subscription.maxMembers) * 100)
      : 0;

    return {
      subscription,
      usage: {
        members: {
          current: activeMembersCount,
          max: subscription.maxMembers,
          percentage: memberUsagePercentage,
          status: memberUsagePercentage >= 90 ? "HIGH" : memberUsagePercentage >= 75 ? "MEDIUM" : "LOW",
        },
        plans: { current: activePlansCount },
      },
      recommendations: this.#getUsageRecommendations(memberUsagePercentage),
    };
  }

  async changePlan(organizationId, currentUserId, newPlanName) {
    const adminMembership = await this.#getAdminMembership(currentUserId, organizationId);
    const current = await this.#getSubscription(organizationId);

    const availablePlans = await this.getAvailablePlans();
    const target = availablePlans.find(p => p.name === newPlanName);
    if (!target) throw new Error("Plan invalide ou non disponible");

    await this.#validatePlanChange(current, target);

    const updated = await prisma.subscription.update({
      where: { organizationId },
      data: {
        plan: newPlanName,
        maxMembers: typeof target.features.maxMembers === "number" ? target.features.maxMembers : 1000,
        price: target.price,
        status: "ACTIVE",
        startDate: new Date(),
        endDate: this.#calculateEndDate(newPlanName),
      },
      include: { organization: { select: { id: true, name: true, currency: true } } },
    });

    await prisma.auditLog.create({
      data: {
        action: "CHANGE_SUBSCRIPTION_PLAN",
        resource: "subscription",
        resourceId: updated.id,
        userId: currentUserId,
        organizationId,
        membershipId: adminMembership.id,
        details: JSON.stringify({
          oldPlan: current.plan,
          newPlan: updated.plan,
          oldPrice: current.price,
          newPrice: updated.price,
          oldMaxMembers: current.maxMembers,
          newMaxMembers: updated.maxMembers,
        }),
      },
    });

    return { success: true, subscription: updated, previousPlan: current.plan, nextBillingDate: updated.endDate };
  }

  async getAvailablePlans() {
    return [
      { id: "free", name: "FREE", displayName: "Gratuit", price: 0, features: { maxMembers: 50 } },
      { id: "basic", name: "BASIC", displayName: "Basique", price: 5000, features: { maxMembers: 200 } },
      { id: "premium", name: "PREMIUM", displayName: "Premium", price: 15000, features: { maxMembers: 500 } },
      { id: "enterprise", name: "ENTERPRISE", displayName: "Entreprise", price: 30000, features: { maxMembers: "Illimité" } },
    ];
  }
}
