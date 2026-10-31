import { describe, expect, it } from "vitest";

import { ConfigurationError, loadApiConfig } from "./config.js";

describe("loadApiConfig", () => {
  it.each([{}, { ANALYZER: "fake" }])(
    "keeps the deterministic analyzer by default",
    (env) => {
      expect(loadApiConfig(env)).toEqual({ analyzer: "fake" });
    },
  );

  it("loads the documented OpenAI defaults", () => {
    expect(
      loadApiConfig({ ANALYZER: "openai", OPENAI_API_KEY: "test-key" }),
    ).toEqual({
      analyzer: "openai",
      apiKey: "test-key",
      model: "gpt-6-luna",
      baseURL: "https://api.openai.com/v1",
      reasoningEffort: "low",
      timeoutMs: 30_000,
    });
  });

  it("accepts explicit endpoint and timeout overrides", () => {
    expect(
      loadApiConfig({
        ANALYZER: "openai",
        OPENAI_API_KEY: "test-key",
        OPENAI_BASE_URL: "https://eu.api.openai.com/v1",
        OPENAI_TIMEOUT_MS: "12000",
      }),
    ).toMatchObject({
      baseURL: "https://eu.api.openai.com/v1",
      timeoutMs: 12_000,
    });
  });

  it.each([
    ["unknown analyzer", { ANALYZER: "other" }],
    ["missing key", { ANALYZER: "openai" }],
    [
      "unsupported reasoning effort",
      {
        ANALYZER: "openai",
        OPENAI_API_KEY: "test-key",
        OPENAI_REASONING_EFFORT: "medium",
      },
    ],
    [
      "insecure remote endpoint",
      {
        ANALYZER: "openai",
        OPENAI_API_KEY: "test-key",
        OPENAI_BASE_URL: "http://api.example.test/v1",
      },
    ],
    [
      "zero timeout",
      {
        ANALYZER: "openai",
        OPENAI_API_KEY: "test-key",
        OPENAI_TIMEOUT_MS: "0",
      },
    ],
    [
      "fractional timeout",
      {
        ANALYZER: "openai",
        OPENAI_API_KEY: "test-key",
        OPENAI_TIMEOUT_MS: "1.5",
      },
    ],
  ])("rejects %s without exposing credentials", (_case, env) => {
    const secret = "OPENAI_API_KEY" in env ? env.OPENAI_API_KEY : undefined;

    expect(() => loadApiConfig(env)).toThrow(ConfigurationError);
    try {
      loadApiConfig(env);
    } catch (error) {
      if (secret) expect(String(error)).not.toContain(secret);
    }
  });

  it("allows an HTTP endpoint for a local test double", () => {
    expect(
      loadApiConfig({
        ANALYZER: "openai",
        OPENAI_API_KEY: "test-key",
        OPENAI_BASE_URL: "http://127.0.0.1:4010/v1",
      }),
    ).toMatchObject({ baseURL: "http://127.0.0.1:4010/v1" });
  });
});
