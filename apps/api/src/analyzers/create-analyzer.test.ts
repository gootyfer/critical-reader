import { describe, expect, it, vi } from "vitest";

import type { OpenAIAnalyzerConfig } from "../config.js";
import { ConfigurationError } from "../config.js";
import { FakeArticleAnalyzer } from "./fake-analyzer.js";
import { createArticleAnalyzer } from "./create-analyzer.js";

const openAIConfig: OpenAIAnalyzerConfig = {
  analyzer: "openai",
  apiKey: "private-test-key",
  model: "gpt-6-luna",
  baseURL: "https://api.openai.com/v1",
  reasoningEffort: "low",
  timeoutMs: 30_000,
};

describe("createArticleAnalyzer", () => {
  it("creates the deterministic fake analyzer", () => {
    const configured = createArticleAnalyzer({ analyzer: "fake" });

    expect(configured.name).toBe("fake");
    expect(configured.analyzer).toBeInstanceOf(FakeArticleAnalyzer);
  });

  it("connects the model analyzer to one injected OpenAI client", async () => {
    const client = {
      analyze: vi.fn().mockResolvedValue({
        status: "completed" as const,
        output: { findings: [] },
      }),
    };
    const createOpenAIClient = vi.fn(() => client);

    const configured = createArticleAnalyzer(openAIConfig, {
      createOpenAIClient,
    });
    const result = await configured.analyzer.analyze({
      title: "Artículo",
      subtitle: "",
      language: "es",
      paragraphs: [{ id: "p0", text: "Texto neutral." }],
    });

    expect(configured.name).toBe("openai");
    expect(result).toEqual({ findings: [] });
    expect(createOpenAIClient).toHaveBeenCalledOnce();
    expect(createOpenAIClient).toHaveBeenCalledWith(openAIConfig);
    expect(client.analyze).toHaveBeenCalledOnce();
  });

  it("does not expose the API key when client construction fails", () => {
    const createOpenAIClient = () => {
      throw new Error(`Failed for ${openAIConfig.apiKey}`);
    };

    expect(() =>
      createArticleAnalyzer(openAIConfig, { createOpenAIClient }),
    ).toThrow(ConfigurationError);
    try {
      createArticleAnalyzer(openAIConfig, { createOpenAIClient });
    } catch (error) {
      expect(String(error)).not.toContain(openAIConfig.apiKey);
    }
  });
});
