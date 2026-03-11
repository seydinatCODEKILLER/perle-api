import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import responseHandler from "./middlewares/responseMiddleware.js";
import logger from "./config/logger.js";
import { getCorsOptions } from "./config/cors.js";
import { generalLimiter } from "./config/rateLimiter.js";
import httpLogger, { errorLogger } from "./utils/Httplogger.js";
import {
  authRoute,
  contributionPlanRoute,
  contributionRoute,
  dashboardRoute,
  debtRoute,
  expenseRoute,
  membershipRoute,
  organisationRoute,
  subscriptionRoute,
  transactionRoute,
  walletRoute,
} from "./utils/Router.js";
import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { swaggerOptions } from "./config/swagger.js";

const app = express();
app.use((req, res, next) => {
  console.log("\n📥 ==================== INCOMING REQUEST ====================");
  console.log("Time:", new Date().toISOString());
  console.log("Method:", req.method);
  console.log("Path:", req.path);
  console.log("Full URL:", req.url);
  console.log("\nHeaders:");
  console.log("- Origin:", req.headers.origin);
  console.log("- Cookie:", req.headers.cookie || "NONE");
  console.log("- Authorization:", req.headers.authorization || "NONE");
  console.log("- User-Agent:", req.headers["user-agent"]?.substring(0, 60) + "...");
  console.log("===========================================================\n");
  next();
});
const specs = swaggerJSDoc(swaggerOptions);

// ✅ Middlewares globaux dans le bon ordre
app.use(cors(getCorsOptions()));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(httpLogger);
app.use(responseHandler);

// ✅ Rate limiter général appliqué à toutes les routes API
app.use("/api", generalLimiter);

// Logger middleware
logger.info("API middlewares initialized");

// Routes
app.use("/api/auth", authRoute.routes);
app.use("/api/organizations", organisationRoute.routes);
app.use("/api/membership", membershipRoute.routes);
app.use("/api/contribution-plans", contributionPlanRoute.routes);
app.use("/api/contributions", contributionRoute.routes);
app.use("/api/debts", debtRoute.routes);
app.use("/api/transactions", transactionRoute.routes);
app.use("/api/subscriptions", subscriptionRoute.routes);
app.use("/api/statistiques", dashboardRoute.routes);
app.use("/api/wallet", walletRoute.routes);
app.use("/api/expenses", expenseRoute.routes);

// Documentation Swagger
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(specs));

// Route par défaut pour vérifier que l'API tourne
app.get("/", (req, res) => {
  res.status(200).json({ 
    message: "API is running",
    version: "1.0.0",
    timestamp: new Date().toISOString()
  });
});

// Route 404 — doit être en dernier
app.use((req, res) => {
  logger.warn({ method: req.method, url: req.url }, "Route not found");
  res.status(404).json({ message: "Route not found" });
});

// Error logger
app.use(errorLogger);

// Gestion des erreurs non catchées
process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "Uncaught Exception");
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error({ reason, promise }, "Unhandled Rejection");
});

export default app;