import Fastify from "fastify";

import { createConfiguredServer, loadLocalEnv } from "./bootstrap.js";

loadLocalEnv();

const app = await createConfiguredServer(process.env, {
  fastifyFactory: Fastify,
  logger: true,
});

export default app;
