import {
  AnalyzeResponseSchema,
  type AnalyzeRequest,
} from "../../contracts.js";

import type { ArticleAnalyzer } from "../article-analyzer.js";
import { ArticleAnalyzerError } from "../analyzer-error.js";
import type { AnalysisModelClient } from "./analysis-model-client.js";
import { buildAnalysisMessages } from "./prompt.js";

export class ModelArticleAnalyzer implements ArticleAnalyzer {
  constructor(private readonly client: AnalysisModelClient) {}

  async analyze(input: AnalyzeRequest) {
    const result = await this.client.analyze(buildAnalysisMessages(input));

    if (result.status !== "completed") {
      throw new ArticleAnalyzerError(result.status);
    }

    const parsed = AnalyzeResponseSchema.safeParse(result.output);
    if (!parsed.success) throw new ArticleAnalyzerError("invalid_response");

    const inputIds = new Set(input.paragraphs.map(({ id }) => id));
    if (parsed.data.findings.some(({ paragraphId }) => !inputIds.has(paragraphId))) {
      throw new ArticleAnalyzerError("invalid_response");
    }

    return parsed.data;
  }
}
