import { APIConnectionTimeoutError } from "openai";
import { describe, expect, it, vi } from "vitest";

import type { OpenAIAnalyzerConfig } from "../../config.js";
import { SdkOpenAIAnalysisClient } from "./sdk-openai-client.js";

const config: OpenAIAnalyzerConfig = {
  analyzer: "openai",
  apiKey: "test-key",
  model: "gpt-6-luna",
  baseURL: "https://api.openai.com/v1",
  reasoningEffort: "low",
  timeoutMs: 30_000,
};

const request = {
  instructions: "Clasifica el artículo.",
  articleJson: '{"title":"Artículo"}',
};

const completedResponse = (output: unknown) => ({
  status: "completed",
  output_parsed: output,
  output: [],
});

describe("SdkOpenAIAnalysisClient", () => {
  it("sends the constrained Responses API request without retries", async () => {
    const output = { findings: [] };
    const parse = vi.fn().mockResolvedValue(completedResponse(output));
    const client = new SdkOpenAIAnalysisClient(config, { responses: { parse } });

    await expect(client.analyze(request)).resolves.toEqual({
      status: "completed",
      output,
    });
    expect(parse).toHaveBeenCalledTimes(1);

    const [body, options] = parse.mock.calls[0]!;
    expect(body).toMatchObject({
      model: "gpt-6-luna",
      instructions: request.instructions,
      input: [{ role: "user", content: request.articleJson }],
      store: false,
      reasoning: { effort: "low" },
      max_output_tokens: 4_000,
      tools: [],
    });
    expect(options).toMatchObject({ maxRetries: 0 });
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it("builds a structured format that parses the shared response schema", async () => {
    const parse = vi.fn().mockResolvedValue(completedResponse({ findings: [] }));
    const client = new SdkOpenAIAnalysisClient(config, { responses: { parse } });

    await client.analyze(request);

    const format = parse.mock.calls[0]![0].text.format;
    expect(format).toMatchObject({ type: "json_schema", name: "article_analysis" });
    expect(format.$parseRaw('{"findings":[]}')).toEqual({ findings: [] });
    expect(() => format.$parseRaw('{"findings":[{"paragraphId":"p0"}]}')).toThrow();
  });

  it("maps a refusal without exposing its text", async () => {
    const parse = vi.fn().mockResolvedValue({
      status: "completed",
      output_parsed: null,
      output: [
        {
          type: "message",
          content: [{ type: "refusal", refusal: "sensitive refusal" }],
        },
      ],
    });
    const client = new SdkOpenAIAnalysisClient(config, { responses: { parse } });

    await expect(client.analyze(request)).resolves.toEqual({ status: "refused" });
  });

  it("maps an incomplete response", async () => {
    const parse = vi.fn().mockResolvedValue({
      status: "incomplete",
      output_parsed: null,
      output: [],
    });
    const client = new SdkOpenAIAnalysisClient(config, { responses: { parse } });

    await expect(client.analyze(request)).resolves.toEqual({ status: "incomplete" });
  });

  it("maps timeout and provider failures without copying remote messages", async () => {
    const timeoutParse = vi
      .fn()
      .mockRejectedValue(new APIConnectionTimeoutError({ message: "remote secret" }));
    const providerParse = vi.fn().mockRejectedValue(new Error("provider secret"));

    for (const [parse, code, secret] of [
      [timeoutParse, "timeout", "remote secret"],
      [providerParse, "provider_error", "provider secret"],
    ] as const) {
      const client = new SdkOpenAIAnalysisClient(config, { responses: { parse } });
      try {
        await client.analyze(request);
        throw new Error("Expected analysis to fail");
      } catch (error) {
        expect(error).toMatchObject({ code });
        expect(String(error)).not.toContain(secret);
      }
      expect(parse).toHaveBeenCalledTimes(1);
    }
  });
});
