import app from "./app.js";
import { env } from "./config/env.js";
import logger from "./config/logger.js";

const config = {
  development: {
    baseUrl: `http://localhost:${env.PORT}`,
  },
  production: {
    baseUrl: "",
  },
};

const { baseUrl } = config[env.NODE_ENV] ?? config.production;

app.listen(env.PORT, "0.0.0.0", () => {
  logger.info(`🚀 Server running on: ${baseUrl}`);
  logger.info(`📚 API Docs: ${baseUrl}/api/docs`);
  logger.info(`🌍 Environment: ${env.NODE_ENV}`);
  logger.info(`🔗 Frontend URL: ${env.FRONTEND_URL}`);
  logger.info(`🍪 Cookies enabled with CORS`);
});
