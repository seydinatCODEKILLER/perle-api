import MembershipService from "../services/MembershipService.js";
import MembershipSchema from "../schemas/MembershipSchema.js";

export default class MembershipController {
  constructor() {
    this.service = new MembershipService();
    this.schema = new MembershipSchema();
  }

  async createMembership(req, res) {
    try {
      this.schema.validateCreate(req.body);

      const { organizationId } = req.params;
      const userId = req.user.id;

      const membership = await this.service.createMembership(
        organizationId,
        userId,
        req.body
      );

      return res.success(membership, "Membre ajouté avec succès", 201);
    } catch (error) {
      return res.error(error.message, 400);
    }
  }

  async getMembership(req, res) {
    try {
      const { organizationId, id } = req.params;
      const userId = req.user.id;

      const membership = await this.service.getMembershipById(
        organizationId,
        id,
        userId
      );

      return res.success(membership, "Membre récupéré avec succès");
    } catch (error) {
      const statusCode = error.message.includes("non autorisé") ? 403 : 404;
      return res.error(error.message, statusCode);
    }
  }

  async getOrganizationMembers(req, res) {
    try {
      const { organizationId } = req.params;
      const userId = req.user.id;
      const { status, role, search, page, limit } = req.query;

      const result = await this.service.getOrganizationMembers(
        organizationId,
        userId,
        {
          status,
          role,
          search,
          page: parseInt(page) || 1,
          limit: parseInt(limit) || 10,
        }
      );

      return res.success(result, "Membres récupérés avec succès");
    } catch (error) {
      return res.error(error.message, 400);
    }
  }

  async updateMembership(req, res) {
    try {
      // Validation des données
      this.schema.validateUpdate(req.body);

      const { organizationId, id } = req.params;
      const userId = req.user.id;

      const membership = await this.service.updateMembership(
        organizationId,
        id,
        userId,
        req.body
      );

      return res.success(membership, "Membre mis à jour avec succès");
    } catch (error) {
      const statusCode = error.message.includes("Permissions") ? 403 : 400;
      return res.error(error.message, statusCode);
    }
  }

  async updateMembershipStatus(req, res) {
    try {
      this.schema.validateStatusUpdate(req.body);
      const { organizationId, id } = req.params;
      const userId = req.user.id;
      const { status } = req.body;

      if (!status) {
        return res.error("Le statut est requis", 400);
      }

      const membership = await this.service.updateMembershipStatus(
        organizationId,
        id,
        userId,
        status
      );

      return res.success(membership, "Statut du membre mis à jour avec succès");
    } catch (error) {
      const statusCode = error.message.includes("Permissions") ? 403 : 400;
      return res.error(error.message, statusCode);
    }
  }

  async updateMembershipRole(req, res) {
    try {
        this.schema.validateRoleUpdate(req.body);
      const { organizationId, id } = req.params;
      const userId = req.user.id;
      const { role } = req.body;

      const membership = await this.service.updateMembershipRole(
        organizationId,
        id,
        userId,
        role
      );

      return res.success(membership, "Rôle du membre mis à jour avec succès");
    } catch (error) {
      const statusCode = error.message.includes("Permissions") ? 403 : 400;
      return res.error(error.message, statusCode);
    }
  }

  async deleteMembership(req, res) {
    try {
      const { organizationId, id } = req.params;
      const userId = req.user.id;

      const membership = await this.service.deleteMembership(
        organizationId,
        id,
        userId
      );

      return res.success(membership, "Membre supprimé avec succès");
    } catch (error) {
      const statusCode = error.message.includes("Permissions") ? 403 : 400;
      return res.error(error.message, statusCode);
    }
  }
}
