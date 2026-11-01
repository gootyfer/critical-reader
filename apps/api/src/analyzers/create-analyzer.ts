import {
  ConfigurationError,
  type ApiConfig,
  type OpenAIAnalyzerConfig,
} from "../config.js";
import type { ArticleAnalyzer } from "./article-analyzer.js";
import { FakeArticleAnalyzer } from "./fake-analyzer.js";
import type { AnalysisModelClient } from "./model/analysis-model-client.js";
import { ModelArticleAnalyzer } from "./model/model-analyzer.js";
import { SdkOpenAIAnalysisClient } from "./openai/sdk-openai-client.js";

export interface ConfiguredAnalyzer {
  name: "fake" | "openai";
  analyzer: ArticleAnalyzer;
}

export interface AnalyzerDependencies {
  createOpenAIClient?: (config: OpenAIAnalyzerConfig) => AnalysisModelClient;
}

export const createArticleAnalyzer = (
  config: ApiConfig,
  dependencies: AnalyzerDependencies = {},
): ConfiguredAnalyzer => {
  if (config.analyzer === "fake") {
    return { name: "fake", analyzer: new FakeArticleAnalyzer() };
  }

  try {
    const client =
      dependencies.createOpenAIClient?.(config) ??
      new SdkOpenAIAnalysisClient(config);
    return { name: "openai", analyzer: new ModelArticleAnalyzer(client) };
  } catch {
    throw new ConfigurationError();
  }
};
