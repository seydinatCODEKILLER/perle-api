import ExpenseService from "../services/ExpenseService.js";
import ExpenseSchema from "../schemas/ExpenseSchema.js";

export default class ExpenseController {
  constructor() {
    this.service = new ExpenseService();
    this.schema = new ExpenseSchema();
  }

  async createExpense(req, res) {
    try {
      const { organizationId } = req.params;
      const userId = req.user.id;
      
      // Validation des données d'entrée
      const validatedData = this.schema.validateCreate(req.body);

      const expense = await this.service.createExpense(
        organizationId,
        userId,
        validatedData
      );

      return res.success(expense, "Dépense créée avec succès");
    } catch (error) {
      const statusCode = error.message.includes("Accès") ? 403 
        : error.message.includes("Wallet") ? 404 
        : error.message.includes(":") ? 400 // Erreurs de validation Zod
        : 400;
      return res.error(error.message, statusCode);
    }
  }

  async approveExpense(req, res) {
    try {
      const { organizationId, expenseId } = req.params;
      const userId = req.user.id;

      // Validation des IDs
      this.schema.validateIdParam(expenseId);

      const expense = await this.service.approveExpense(
        organizationId,
        expenseId,
        userId
      );

      return res.success(expense, "Dépense approuvée avec succès");
    } catch (error) {
      const statusCode = error.message.includes("introuvable") ? 404 
        : error.message.includes("Permissions") ? 403 
        : error.message.includes(":") ? 400
        : 400;
      return res.error(error.message, statusCode);
    }
  }

  async rejectExpense(req, res) {
    try {
      const { organizationId, expenseId } = req.params;
      const userId = req.user.id;

      // Validation des IDs et de la raison
      this.schema.validateIdParam(expenseId);
      const validatedData = this.schema.validateReject(req.body);

      const expense = await this.service.rejectExpense(
        organizationId,
        expenseId,
        userId,
        validatedData.reason
      );

      return res.success(expense, "Dépense rejetée avec succès");
    } catch (error) {
      const statusCode = error.message.includes("introuvable") ? 404 
        : error.message.includes("Permissions") ? 403 
        : error.message.includes(":") ? 400
        : 400;
      return res.error(error.message, statusCode);
    }
  }

  async payExpense(req, res) {
    try {
      const { organizationId, expenseId } = req.params;
      const userId = req.user.id;

      // Validation des IDs et des données de paiement
      this.schema.validateIdParam(expenseId);
      const validatedData = this.schema.validatePay(req.body);

      const expense = await this.service.payExpense(
        organizationId,
        expenseId,
        userId,
        validatedData
      );

      return res.success(expense, "Dépense payée avec succès");
    } catch (error) {
      const statusCode = error.message.includes("introuvable") ? 404 
        : error.message.includes("Permissions") ? 403 
        : error.message.includes("solde insuffisant") ? 400 
        : error.message.includes(":") ? 400
        : 400;
      return res.error(error.message, statusCode);
    }
  }

  async getExpenses(req, res) {
    try {
      const { organizationId } = req.params;
      const userId = req.user.id;
      
      // Validation des filtres de recherche
      const validatedFilters = this.schema.validateGetExpenses(req.query);

      const result = await this.service.getExpenses(
        organizationId,
        userId,
        validatedFilters
      );

      return res.success(result, "Dépenses récupérées avec succès");
    } catch (error) {
      const statusCode = error.message.includes("Accès") ? 403 
        : error.message.includes(":") ? 400
        : 400;
      return res.error(error.message, statusCode);
    }
  }

  async getExpenseById(req, res) {
    try {
      const { organizationId, expenseId } = req.params;
      const userId = req.user.id;

      // Validation de l'ID
      this.schema.validateIdParam(expenseId);

      const expense = await this.service.getExpenseById(
        organizationId,
        expenseId,
        userId
      );

      return res.success(expense, "Dépense récupérée avec succès");
    } catch (error) {
      const statusCode = error.message.includes("introuvable") ? 404 
        : error.message.includes("Accès") ? 403 
        : error.message.includes(":") ? 400
        : 400;
      return res.error(error.message, statusCode);
    }
  }

  async getExpenseStats(req, res) {
    try {
      const { organizationId } = req.params;
      const userId = req.user.id;
      
      // Validation des filtres de date
      const validatedFilters = this.schema.validateStats(req.query);

      const stats = await this.service.getExpenseStats(
        organizationId,
        userId,
        validatedFilters
      );

      return res.success(stats, "Statistiques des dépenses récupérées avec succès");
    } catch (error) {
      const statusCode = error.message.includes("Accès") ? 403 
        : error.message.includes(":") ? 400
        : 400;
      return res.error(error.message, statusCode);
    }
  }

  async cancelExpense(req, res) {
    try {
      const { organizationId, expenseId } = req.params;
      const userId = req.user.id;

      // Validation des IDs et de la raison
      this.schema.validateIdParam(expenseId);
      const validatedData = this.schema.validateCancel(req.body);

      const expense = await this.service.cancelExpense(
        organizationId,
        expenseId,
        userId,
        validatedData.reason
      );

      return res.success(expense, "Dépense annulée avec succès");
    } catch (error) {
      const statusCode = error.message.includes("introuvable") ? 404 
        : error.message.includes("Permissions") ? 403 
        : error.message.includes("déjà payée") ? 400 
        : error.message.includes(":") ? 400
        : 400;
      return res.error(error.message, statusCode);
    }
  }
}