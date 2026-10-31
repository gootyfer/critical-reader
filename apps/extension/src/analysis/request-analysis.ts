import {
  AnalyzeResponseSchema,
  type AnalyzeRequest,
  type AnalyzeResponse,
} from "@critical-reader/contracts";

const ANALYZE_ENDPOINT = "http://127.0.0.1:8787/analyze";

export type AnalysisRequestErrorCode =
  | "network_error"
  | "http_error"
  | "invalid_response";

export class AnalysisRequestError extends Error {
  override readonly name = "AnalysisRequestError";

  constructor(
    readonly code: AnalysisRequestErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export async function requestAnalysis(
  fetchFn: typeof fetch,
  input: AnalyzeRequest,
): Promise<AnalyzeResponse> {
  let response: Response;

  try {
    response = await fetchFn(ANALYZE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    throw new AnalysisRequestError(
      "network_error",
      "The analysis service is unavailable",
    );
  }

  if (!response.ok) {
    throw new AnalysisRequestError(
      "http_error",
      "The analysis service returned an error",
    );
  }

  try {
    return AnalyzeResponseSchema.parse(await response.json());
  } catch {
    throw new AnalysisRequestError(
      "invalid_response",
      "The analysis service returned an invalid response",
    );
  }
}
