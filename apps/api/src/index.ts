import Fastify from "fastify";

import { createConfiguredServer, loadLocalEnv } from "./bootstrap.js";
import { ConfigurationError } from "./config.js";

const reportStartupError = (error: unknown): void => {
  console.error(
    error instanceof ConfigurationError
      ? "Invalid API configuration"
      : "API failed to start",
  );
  process.exitCode = 1;
};

try {
  loadLocalEnv();
  const host = process.env.API_HOST ?? "127.0.0.1";
  const port = Number.parseInt(process.env.API_PORT ?? "8787", 10);
  const app = await createConfiguredServer(process.env, {
    fastifyFactory: Fastify,
    logger: true,
  });
  void app.listen({ host, port }).catch(reportStartupError);
} catch (error) {
  reportStartupError(error);
}
