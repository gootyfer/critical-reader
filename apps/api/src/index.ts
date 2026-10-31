import { buildServer } from "./server.js";

const host = process.env.API_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.API_PORT ?? "8787", 10);

const app = await buildServer({ logger: true });

try {
  await app.listen({ host, port });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
