import { createArticleAnalyzer } from "../analyzers/create-analyzer.js";
import { loadLocalEnv } from "../bootstrap.js";
import { loadApiConfig } from "../config.js";
import { runEvaluation } from "./evaluate-cases.js";
import { OPENAI_EVALUATION_CASES } from "./openai-cases.js";

try {
  loadLocalEnv();
  const config = loadApiConfig(process.env);
  if (config.analyzer !== "openai") {
    throw new Error("OpenAI analyzer is not configured");
  }

  const configured = createArticleAnalyzer(config);
  const result = await runEvaluation(
    configured.analyzer,
    OPENAI_EVALUATION_CASES,
    console.log,
  );
  process.exitCode = result.exitCode;
} catch {
  console.error("OpenAI evaluation could not start");
  process.exitCode = 1;
}
