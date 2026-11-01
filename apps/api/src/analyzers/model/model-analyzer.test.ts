import type { AnalyzeRequest } from "@critical-reader/contracts";
import { describe, expect, it } from "vitest";

import { ArticleAnalyzerError } from "../analyzer-error.js";
import type {
  AnalysisModelClient,
  AnalysisModelRequest,
  AnalysisModelResult,
} from "./analysis-model-client.js";
import { ModelArticleAnalyzer } from "./model-analyzer.js";

const article: AnalyzeRequest = {
  title: "Título",
  subtitle: "Subtítulo",
  language: "es",
  paragraphs: [
    { id: "p0", text: "Contexto." },
    { id: "p1", text: "Contenido." },
  ],
};

class FakeModelClient implements AnalysisModelClient {
  readonly calls: AnalysisModelRequest[] = [];

  constructor(
    private readonly result: AnalysisModelResult | ArticleAnalyzerError,
  ) {}

  async analyze(request: AnalysisModelRequest): Promise<AnalysisModelResult> {
    this.calls.push(request);
    if (this.result instanceof ArticleAnalyzerError) throw this.result;
    return this.result;
  }
}

const completed = (output: unknown): AnalysisModelResult => ({
  status: "completed",
  output,
});

describe("ModelArticleAnalyzer", () => {
  it("sends the complete article once and returns a valid result", async () => {
    const output = {
      findings: [
        {
          paragraphId: "p1",
          category: "sexism",
          mechanism: "stereotype",
          explanation: "Explicación breve.",
        },
      ],
    };
    const client = new FakeModelClient(completed(output));

    await expect(new ModelArticleAnalyzer(client).analyze(article)).resolves.toEqual(
      output,
    );
    expect(client.calls).toHaveLength(1);
    expect(JSON.parse(client.calls[0]!.articleJson)).toEqual(article);
    expect(client.calls[0]!.instructions).toBeTruthy();
  });

  it.each([
    ["unknown", completed({ findings: [{ paragraphId: "unknown", category: "sexism", mechanism: "stereotype", explanation: "Texto." }] })],
    ["duplicate", completed({ findings: [
      { paragraphId: "p0", category: "sexism", mechanism: "stereotype", explanation: "Uno." },
      { paragraphId: "p0", category: "racism_xenophobia", mechanism: "exclusion", explanation: "Dos." },
    ] })],
  ])("rejects %s paragraph identifiers without retrying", async (_case, result) => {
    const client = new FakeModelClient(result);

    await expect(new ModelArticleAnalyzer(client).analyze(article)).rejects.toMatchObject({
      code: "invalid_response",
    });
    expect(client.calls).toHaveLength(1);
  });

  it.each([
    ["refused", { status: "refused" } as const],
    ["incomplete", { status: "incomplete" } as const],
  ])("maps a %s result without retrying", async (code, result) => {
    const client = new FakeModelClient(result);

    await expect(new ModelArticleAnalyzer(client).analyze(article)).rejects.toMatchObject({
      code,
    });
    expect(client.calls).toHaveLength(1);
  });

  it.each(["timeout", "provider_error"] as const)(
    "preserves a %s client error without retrying",
    async (code) => {
      const client = new FakeModelClient(new ArticleAnalyzerError(code));

      await expect(new ModelArticleAnalyzer(client).analyze(article)).rejects.toMatchObject({
        code,
      });
      expect(client.calls).toHaveLength(1);
    },
  );
});
