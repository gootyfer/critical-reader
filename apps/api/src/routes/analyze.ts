import {
  AnalyzeRequestSchema,
  AnalyzeResponseSchema,
} from "../contracts.js";
import type { FastifyInstance } from "fastify";

import type { ArticleAnalyzer } from "../analyzers/article-analyzer.js";
import { ArticleAnalyzerError } from "../analyzers/analyzer-error.js";
import { createContentHash } from "../cache/content-hash.js";
import type { ServerPolicy } from "../server-policy.js";

export async function registerAnalyzeRoute(
  app: FastifyInstance,
  analyzer: ArticleAnalyzer,
  policy: ServerPolicy,
) {
  app.post("/analyze", async (request, reply) => {
    if (!policy.analysisEnabled) {
      return reply.status(503).send({ error: "analysis_disabled" });
    }

    const origin = request.headers.origin;
    if (
      policy.allowedExtensionOrigins.length > 0 &&
      (typeof origin !== "string" ||
        !policy.allowedExtensionOrigins.includes(origin))
    ) {
      return reply.status(403).send({ error: "client_not_allowed" });
    }

    if (
      policy.requiredClientVersion !== null &&
      request.headers["x-critical-reader-version"] !==
        policy.requiredClientVersion
    ) {
      return reply
        .status(426)
        .send({ error: "unsupported_client_version" });
    }

    const parsedRequest = AnalyzeRequestSchema.safeParse(request.body);
    if (!parsedRequest.success) {
      return reply.status(400).send({
        error: "invalid_request",
        issues: parsedRequest.error.issues,
      });
    }

    try {
      const result = AnalyzeResponseSchema.parse(
        await analyzer.analyze(parsedRequest.data),
      );
      const validParagraphIds = new Set(
        parsedRequest.data.paragraphs.map(({ id }) => id),
      );

      if (
        result.findings.some(
          ({ paragraphId }) => !validParagraphIds.has(paragraphId),
        )
      ) {
        request.log.error("Analyzer returned an unknown paragraph identifier");
        return reply.status(502).send({ error: "invalid_analyzer_response" });
      }

      reply.header("X-Content-Hash", createContentHash(parsedRequest.data));
      return result;
    } catch (error) {
      if (error instanceof ArticleAnalyzerError) {
        request.log.error(
          { analysisErrorCode: error.code, requestId: request.id },
          "Article analysis failed",
        );
        if (error.code === "timeout") {
          return reply.status(504).send({ error: "analysis_timeout" });
        }
        return reply.status(502).send({ error: "analysis_provider_error" });
      }

      request.log.error(
        { requestId: request.id },
        "Unexpected article analysis failure",
      );
      return reply.status(500).send({
        statusCode: 500,
        error: "Internal Server Error",
      });
    }
  });
}
