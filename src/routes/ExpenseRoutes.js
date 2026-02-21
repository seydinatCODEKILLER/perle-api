import express from "express";
import ExpenseController from "../controllers/ExpenseController.js";
import AuthMiddleware from "../middlewares/AuthMiddleware.js";

export default class ExpenseRoutes {
  constructor() {
    this.router = express.Router({ mergeParams: true });
    this.controller = new ExpenseController();
    this.authMiddleware = new AuthMiddleware();

    this.setupRoutes();
  }

  setupRoutes() {
    // Routes protégées
    this.router.use(this.authMiddleware.protect());

    /**
     * @swagger
     * /api/expenses/{organizationId}:
     *   get:
     *     summary: Lister toutes les dépenses avec filtres
     *     tags: [Expenses]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: organizationId
     *         required: true
     *         schema:
     *           type: string
     *       - in: query
     *         name: status
     *         schema:
     *           type: string
     *           enum: [PENDING, APPROVED, REJECTED, PAID, CANCELLED]
     *       - in: query
     *         name: category
     *         schema:
     *           type: string
     *           enum: [EVENT, SOCIAL, ADMINISTRATIVE, MAINTENANCE, DONATION, INVESTMENT, OPERATIONAL, OTHER]
     *       - in: query
     *         name: createdById
     *         schema:
     *           type: string
     *       - in: query
     *         name: startDate
     *         schema:
     *           type: string
     *           format: date
     *       - in: query
     *         name: endDate
     *         schema:
     *           type: string
     *           format: date
     *       - in: query
     *         name: search
     *         schema:
     *           type: string
     *       - in: query
     *         name: page
     *         schema:
     *           type: integer
     *           default: 1
     *       - in: query
     *         name: limit
     *         schema:
     *           type: integer
     *           default: 10
     *     responses:
     *       200:
     *         description: Liste des dépenses
     */
    this.router.get("/:organizationId", (req, res) =>
      this.controller.getExpenses(req, res)
    );

    /**
     * @swagger
     * /api/expenses/{organizationId}/create:
     *   post:
     *     summary: Créer une nouvelle dépense
     *     tags: [Expenses]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: organizationId
     *         required: true
     *         schema:
     *           type: string
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - title
     *               - amount
     *               - category
     *             properties:
     *               title:
     *                 type: string
     *               description:
     *                 type: string
     *               amount:
     *                 type: number
     *               category:
     *                 type: string
     *                 enum: [EVENT, SOCIAL, ADMINISTRATIVE, MAINTENANCE, DONATION, INVESTMENT, OPERATIONAL, OTHER]
     *               expenseDate:
     *                 type: string
     *                 format: date
     *     responses:
     *       200:
     *         description: Dépense créée avec succès
     */
    this.router.post("/:organizationId/create", (req, res) =>
      this.controller.createExpense(req, res)
    );

    /**
     * @swagger
     * /api/expenses/{organizationId}/stats:
     *   get:
     *     summary: Statistiques des dépenses
     *     tags: [Expenses]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: organizationId
     *         required: true
     *         schema:
     *           type: string
     *       - in: query
     *         name: startDate
     *         schema:
     *           type: string
     *           format: date
     *       - in: query
     *         name: endDate
     *         schema:
     *           type: string
     *           format: date
     *     responses:
     *       200:
     *         description: Statistiques des dépenses
     */
    this.router.get("/:organizationId/stats", (req, res) =>
      this.controller.getExpenseStats(req, res)
    );

    /**
     * @swagger
     * /api/expenses/{organizationId}/{expenseId}:
     *   get:
     *     summary: Récupérer une dépense par ID
     *     tags: [Expenses]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: organizationId
     *         required: true
     *         schema:
     *           type: string
     *       - in: path
     *         name: expenseId
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Détails de la dépense
     */
    this.router.get("/:organizationId/:expenseId", (req, res) =>
      this.controller.getExpenseById(req, res)
    );

    /**
     * @swagger
     * /api/expenses/{organizationId}/{expenseId}/approve:
     *   put:
     *     summary: Approuver une dépense
     *     tags: [Expenses]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: organizationId
     *         required: true
     *         schema:
     *           type: string
     *       - in: path
     *         name: expenseId
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Dépense approuvée
     */
    this.router.put("/:organizationId/:expenseId/approve", (req, res) =>
      this.controller.approveExpense(req, res)
    );

    /**
     * @swagger
     * /api/expenses/{organizationId}/{expenseId}/reject:
     *   put:
     *     summary: Rejeter une dépense
     *     tags: [Expenses]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: organizationId
     *         required: true
     *         schema:
     *           type: string
     *       - in: path
     *         name: expenseId
     *         required: true
     *         schema:
     *           type: string
     *     requestBody:
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               reason:
     *                 type: string
     *     responses:
     *       200:
     *         description: Dépense rejetée
     */
    this.router.put("/:organizationId/:expenseId/reject", (req, res) =>
      this.controller.rejectExpense(req, res)
    );

    /**
     * @swagger
     * /api/expenses/{organizationId}/{expenseId}/pay:
     *   post:
     *     summary: Payer une dépense approuvée
     *     tags: [Expenses]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: organizationId
     *         required: true
     *         schema:
     *           type: string
     *       - in: path
     *         name: expenseId
     *         required: true
     *         schema:
     *           type: string
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - paymentMethod
     *             properties:
     *               paymentMethod:
     *                 type: string
     *                 enum: [CASH, MOBILE_MONEY, BANK_TRANSFER, CHECK, CREDIT_CARD]
     *     responses:
     *       200:
     *         description: Dépense payée avec succès
     */
    this.router.post("/:organizationId/:expenseId/pay", (req, res) =>
      this.controller.payExpense(req, res)
    );

    /**
     * @swagger
     * /api/expenses/{organizationId}/{expenseId}/cancel:
     *   put:
     *     summary: Annuler une dépense (non payée)
     *     tags: [Expenses]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: organizationId
     *         required: true
     *         schema:
     *           type: string
     *       - in: path
     *         name: expenseId
     *         required: true
     *         schema:
     *           type: string
     *     requestBody:
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               reason:
     *                 type: string
     *     responses:
     *       200:
     *         description: Dépense annulée
     */
    this.router.put("/:organizationId/:expenseId/cancel", (req, res) =>
      this.controller.cancelExpense(req, res)
    );
  }

  get routes() {
    return this.router;
  }
}