export type ArticleAnalyzerErrorCode =
  | "timeout"
  | "provider_error"
  | "refused"
  | "incomplete"
  | "invalid_response";

export class ArticleAnalyzerError extends Error {
  constructor(readonly code: ArticleAnalyzerErrorCode) {
    super(`Article analysis failed: ${code}`);
    this.name = "ArticleAnalyzerError";
  }
}
