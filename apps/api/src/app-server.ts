import Fastify from "fastify";

import type { ArticleAnalyzer } from "./analyzers/article-analyzer.js";
import { FakeArticleAnalyzer } from "./analyzers/fake-analyzer.js";
import { registerAnalyzeRoute } from "./routes/analyze.js";
import { registerFixtureRoutes } from "./routes/fixtures.js";
import { registerPublicPageRoutes } from "./routes/public-pages.js";
import { loadServerPolicy, type ServerPolicy } from "./server-policy.js";

interface LoggerStream {
  write(message: string): void;
}

export interface BuildServerOptions {
  analyzer?: ArticleAnalyzer;
  analyzerName?: "fake" | "openai";
  logger?: boolean;
  loggerStream?: LoggerStream;
  policy?: ServerPolicy;
}

export async function buildServer(options: BuildServerOptions = {}) {
  const policy = options.policy ?? loadServerPolicy({});
  const logger = options.loggerStream
    ? { level: "info", stream: options.loggerStream }
    : (options.logger ?? false);
  const app = Fastify({ logger, bodyLimit: policy.bodyLimitBytes });
  const analyzer = options.analyzer ?? new FakeArticleAnalyzer();

  app.get("/health", async () => ({
    status: "ok",
    analyzer: options.analyzerName ?? "fake",
  }));
  await registerPublicPageRoutes(app);
  await registerAnalyzeRoute(app, analyzer, policy);
  if (policy.fixturesEnabled) await registerFixtureRoutes(app);

  return app;
}
