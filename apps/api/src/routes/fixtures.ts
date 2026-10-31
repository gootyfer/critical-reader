import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { FastifyInstance } from "fastify";

const fixtureFiles = {
  "clear-sexism": "clear-sexism.html",
  "quoted-speech": "quoted-speech.html",
  neutral: "neutral.html",
} as const;

export async function registerFixtureRoutes(app: FastifyInstance) {
  app.get<{ Params: { name: string } }>("/fixtures/:name", async (request, reply) => {
    const fixtureName = request.params.name as keyof typeof fixtureFiles;
    const filename = fixtureFiles[fixtureName];

    if (!filename) {
      return reply.status(404).send({ error: "fixture_not_found" });
    }

    const fixtureUrl = new URL(`../../fixtures/${filename}`, import.meta.url);
    const html = await readFile(fileURLToPath(fixtureUrl), "utf8");
    return reply.type("text/html; charset=utf-8").send(html);
  });
}
