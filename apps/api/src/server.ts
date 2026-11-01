import Fastify from "fastify";

import type { ArticleAnalyzer } from "./analyzers/article-analyzer.js";
import { FakeArticleAnalyzer } from "./analyzers/fake-analyzer.js";
import { registerAnalyzeRoute } from "./routes/analyze.js";
import { registerFixtureRoutes } from "./routes/fixtures.js";

export interface BuildServerOptions {
  analyzer?: ArticleAnalyzer;
  analyzerName?: "fake" | "openai";
  logger?: boolean;
}

export async function buildServer(options: BuildServerOptions = {}) {
  const app = Fastify({ logger: options.logger ?? false });
  const analyzer = options.analyzer ?? new FakeArticleAnalyzer();

  app.get("/health", async () => ({
    status: "ok",
    analyzer: options.analyzerName ?? "fake",
  }));
  await registerAnalyzeRoute(app, analyzer);
  await registerFixtureRoutes(app);

  return app;
}
