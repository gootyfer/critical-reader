import {
  AnalyzeRequestSchema,
  AnalyzeResponseSchema,
} from "@critical-reader/contracts";
import type { FastifyInstance } from "fastify";

import type { ArticleAnalyzer } from "../analyzers/article-analyzer.js";
import { ArticleAnalyzerError } from "../analyzers/analyzer-error.js";
import { createContentHash } from "../cache/content-hash.js";

export async function registerAnalyzeRoute(
  app: FastifyInstance,
  analyzer: ArticleAnalyzer,
) {
  app.post("/analyze", async (request, reply) => {
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
