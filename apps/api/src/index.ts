import { createConfiguredServer, loadLocalEnv } from "./bootstrap.js";
import { ConfigurationError } from "./config.js";

try {
  loadLocalEnv();
  const host = process.env.API_HOST ?? "127.0.0.1";
  const port = Number.parseInt(process.env.API_PORT ?? "8787", 10);
  const app = await createConfiguredServer(process.env, { logger: true });
  await app.listen({ host, port });
} catch (error) {
  console.error(
    error instanceof ConfigurationError
      ? "Invalid API configuration"
      : "API failed to start",
  );
  process.exitCode = 1;
}
