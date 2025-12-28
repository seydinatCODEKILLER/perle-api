import app from "./app.js";
import { env } from "./config/env.js";

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
  console.log(
    `🚀 Serveur démarré ${baseUrl ? `sur : ${baseUrl}` : "(production)"}`
  );
  console.log(`📚 Docs : ${baseUrl ? `${baseUrl}/api/docs` : "/api/docs"}`);
});
