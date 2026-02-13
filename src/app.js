import express from "express";
import cors from "cors";
import responseHandler from "./middlewares/responseMiddleware.js";
import logger from "./config/logger.js";
import {
  authRoute,
  contributionPlanRoute,
  contributionRoute,
  dashboardRoute,
  debtRoute,
  membershipRoute,
  organisationRoute,
  subscriptionRoute,
  transactionRoute,
} from "./utils/Router.js";
import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { swaggerOptions } from "./config/swagger.js";
import { generalLimiter } from "./config/rateLimiter.js";
import httpLogger, { errorLogger } from "./utils/Httplogger.js";

const app = express();
const specs = swaggerJSDoc(swaggerOptions);

// Middlewares globaux
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(httpLogger);
app.use(responseHandler);

// Appliquer le rate limiter général à toutes les routes API
app.use("/api", generalLimiter);

// Logger middleware
logger.info("API middlewares initialized");

app.use("/api/auth", authRoute.routes);
app.use("/api/organizations", organisationRoute.routes);
app.use("/api/membership", membershipRoute.routes);
app.use("/api/contribution-plans", contributionPlanRoute.routes);
app.use("/api/contributions", contributionRoute.routes);
app.use("/api/debts", debtRoute.routes);
app.use("/api/transactions", transactionRoute.routes);
app.use("/api/subscriptions", subscriptionRoute.routes);
app.use("/api/statistiques", dashboardRoute.routes);

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(specs));

// Route par défaut pour vérifier que l'API tourne
app.get("/", (req, res) => {
  res.status(200).json({ message: "API is running" });
});

// Route 404 — doit être en dernier
app.use((req, res) => {
  logger.warn({ method: req.method, url: req.url }, "Route not found");
  res.status(404).json({ message: "Route not found" });
});
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
