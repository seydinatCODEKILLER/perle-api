import SubscriptionService from "../services/SubscriptionService.js";

export default class SubscriptionController {
  constructor() {
    this.service = new SubscriptionService();
  }

  async getSubscription(req, res) {
    try {
      const { organizationId } = req.params;
      const userId = req.user.id;

      const subscription = await this.service.getOrganizationSubscription(
        organizationId,
        userId
      );

      return res.success(subscription, "Abonnement récupéré avec succès");
    } catch (error) {
      const statusCode = error.message.includes("non autorisé") ? 403 : 404;
      return res.error(error.message, statusCode);
    }
  }

  async updateSubscription(req, res) {
    try {
      const { organizationId } = req.params;
      const userId = req.user.id;

      const subscription = await this.service.updateSubscription(
        organizationId,
        userId,
        req.body
      );

      return res.success(subscription, "Abonnement mis à jour avec succès");
    } catch (error) {
      const statusCode = error.message.includes("Permissions") ? 403 : 400;
      return res.error(error.message, statusCode);
    }
  }

  async updateSubscriptionStatus(req, res) {
    try {
      const { organizationId } = req.params;
      const userId = req.user.id;
      const { status } = req.body;

      if (!status) {
        return res.error("Le statut est requis", 400);
      }

      const subscription = await this.service.updateSubscriptionStatus(
        organizationId,
        userId,
        status
      );

      return res.success(subscription, "Statut de l'abonnement mis à jour avec succès");
    } catch (error) {
      const statusCode = error.message.includes("Permissions") ? 403 : 400;
      return res.error(error.message, statusCode);
    }
  }

  async getUsage(req, res) {
    try {
      const { organizationId } = req.params;
      const userId = req.user.id;

      const usage = await this.service.getSubscriptionUsage(
        organizationId,
        userId
      );

      return res.success(usage, "Utilisation récupérée avec succès");
    } catch (error) {
      return res.error(error.message, 400);
    }
  }

  async getAvailablePlans(req, res) {
    try {
      const plans = await this.service.getAvailablePlans();

      return res.success(plans, "Plans disponibles récupérés avec succès");
    } catch (error) {
      return res.error(error.message, 400);
    }
  }

  async changePlan(req, res) {
    try {
      const { organizationId } = req.params;
      const userId = req.user.id;
      const { plan } = req.body;

      if (!plan) {
        return res.error("Le plan est requis", 400);
      }

      const result = await this.service.changePlan(
        organizationId,
        userId,
        plan
      );

      return res.success(result, "Plan changé avec succès");
    } catch (error) {
      return res.error(error.message, 400);
    }
  }
}