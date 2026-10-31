export interface FakeAnalyzerConfig {
  analyzer: "fake";
}

export interface OpenAIAnalyzerConfig {
  analyzer: "openai";
  apiKey: string;
  model: string;
  baseURL: string;
  reasoningEffort: "low";
  timeoutMs: number;
}

export type ApiConfig = FakeAnalyzerConfig | OpenAIAnalyzerConfig;

export class ConfigurationError extends Error {
  constructor() {
    super("Invalid API configuration");
    this.name = "ConfigurationError";
  }
}

const parseBaseURL = (value: string): string => {
  try {
    const url = new URL(value);
    const isSecure = url.protocol === "https:";
    const isLocalDouble =
      url.protocol === "http:" && url.hostname === "127.0.0.1";

    if (!isSecure && !isLocalDouble) throw new ConfigurationError();
    return value;
  } catch (error) {
    if (error instanceof ConfigurationError) throw error;
    throw new ConfigurationError();
  }
};

const parseTimeout = (value: string): number => {
  const timeoutMs = Number(value);
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new ConfigurationError();
  }
  return timeoutMs;
};

export const loadApiConfig = (env: NodeJS.ProcessEnv): ApiConfig => {
  const analyzer = env.ANALYZER ?? "fake";
  if (analyzer === "fake") return { analyzer };
  if (analyzer !== "openai") throw new ConfigurationError();

  const apiKey = env.OPENAI_API_KEY?.trim();
  const model = env.OPENAI_MODEL?.trim() || "gpt-6-luna";
  const reasoningEffort = env.OPENAI_REASONING_EFFORT ?? "low";

  if (!apiKey || reasoningEffort !== "low") throw new ConfigurationError();

  return {
    analyzer,
    apiKey,
    model,
    baseURL: parseBaseURL(
      env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    ),
    reasoningEffort,
    timeoutMs: parseTimeout(env.OPENAI_TIMEOUT_MS ?? "30000"),
  };
};
