import {
  AnalyzeRequestSchema,
  type AnalyzeRequest,
  type AnalyzeResponse,
} from "@critical-reader/contracts";

export interface AnalyzeArticleMessage {
  type: "ANALYZE_ARTICLE";
  payload: AnalyzeRequest;
}

export type AnalyzeArticleResult =
  | { ok: true; data: AnalyzeResponse }
  | { ok: false; error: "analysis_failed" };

export function isAnalyzeArticleMessage(
  value: unknown,
): value is AnalyzeArticleMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as { type?: unknown; payload?: unknown };
  return (
    candidate.type === "ANALYZE_ARTICLE" &&
    AnalyzeRequestSchema.safeParse(candidate.payload).success
  );
}
