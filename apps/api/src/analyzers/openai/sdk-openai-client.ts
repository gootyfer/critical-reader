import { AnalyzeResponseSchema } from "@critical-reader/contracts";
import OpenAI, {
  APIConnectionTimeoutError,
  APIUserAbortError,
} from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import type { OpenAIAnalyzerConfig } from "../../config.js";
import { ArticleAnalyzerError } from "../analyzer-error.js";
import type {
  AnalysisModelClient,
  AnalysisModelRequest,
  AnalysisModelResult,
} from "../model/analysis-model-client.js";

interface ParsedResponseLike {
  status?: string;
  output_parsed: unknown;
  output: Array<{
    type?: string;
    content?: Array<{ type?: string }>;
  }>;
}

export interface OpenAIResponsesPort {
  responses: {
    parse(body: unknown, options?: unknown): Promise<ParsedResponseLike>;
  };
}

const containsRefusal = (response: ParsedResponseLike): boolean =>
  response.output.some(
    (item) =>
      item.type === "message" &&
      item.content?.some((content) => content.type === "refusal"),
  );

const isTimeoutError = (error: unknown): boolean =>
  error instanceof APIConnectionTimeoutError ||
  error instanceof APIUserAbortError ||
  (error instanceof Error &&
    (error.name === "TimeoutError" || error.name === "AbortError"));

export class SdkOpenAIAnalysisClient implements AnalysisModelClient {
  private readonly sdk: OpenAIResponsesPort;

  constructor(
    private readonly config: OpenAIAnalyzerConfig,
    sdk?: OpenAIResponsesPort,
  ) {
    this.sdk =
      sdk ??
      (new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        maxRetries: 0,
      }) as OpenAIResponsesPort);
  }

  async analyze(request: AnalysisModelRequest): Promise<AnalysisModelResult> {
    try {
      const response = await this.sdk.responses.parse(
        {
          model: this.config.model,
          instructions: request.instructions,
          input: [{ role: "user", content: request.articleJson }],
          text: {
            format: zodTextFormat(AnalyzeResponseSchema, "article_analysis"),
          },
          store: false,
          reasoning: { effort: this.config.reasoningEffort },
          max_output_tokens: 4_000,
          tools: [],
        },
        {
          signal: AbortSignal.timeout(this.config.timeoutMs),
          maxRetries: 0,
        },
      );

      if (containsRefusal(response)) return { status: "refused" };
      if (response.status === "incomplete") return { status: "incomplete" };
      if (response.status !== "completed") {
        throw new ArticleAnalyzerError("provider_error");
      }

      return { status: "completed", output: response.output_parsed };
    } catch (error) {
      if (error instanceof ArticleAnalyzerError) throw error;
      throw new ArticleAnalyzerError(
        isTimeoutError(error) ? "timeout" : "provider_error",
      );
    }
  }
}
