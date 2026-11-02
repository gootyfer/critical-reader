import type { AnalyzeRequest, AnalyzeResponse } from "../contracts.js";

export interface ArticleAnalyzer {
  analyze(input: AnalyzeRequest): Promise<AnalyzeResponse>;
}
