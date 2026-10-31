import type { AnalyzeRequest, AnalyzeResponse } from "@critical-reader/contracts";

export interface ArticleAnalyzer {
  analyze(input: AnalyzeRequest): Promise<AnalyzeResponse>;
}
