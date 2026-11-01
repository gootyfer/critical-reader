import type { ArticleAnalyzer } from "../analyzers/article-analyzer.js";
import type { EvaluationCase } from "./openai-cases.js";
import {
  calculateEvaluationMetrics,
  type EvaluationMetrics,
  type EvaluationResult,
} from "./metrics.js";

export interface EvaluationRun {
  metrics: EvaluationMetrics;
  exitCode: 0 | 1;
}

export const runEvaluation = async (
  analyzer: ArticleAnalyzer,
  cases: readonly EvaluationCase[],
  write: (line: string) => void,
  now: () => number = performance.now.bind(performance),
): Promise<EvaluationRun> => {
  const results: EvaluationResult[] = [];

  for (const evaluationCase of cases) {
    const startedAt = now();
    try {
      const actual = await analyzer.analyze(evaluationCase.request);
      const latencyMs = Math.round(now() - startedAt);
      results.push({ expected: evaluationCase.expected, actual });
      write(
        `case=${evaluationCase.id} expected=${evaluationCase.expected.findings.length} actual=${actual.findings.length} latency_ms=${latencyMs}`,
      );
    } catch {
      const latencyMs = Math.round(now() - startedAt);
      results.push({ expected: evaluationCase.expected, actual: null });
      write(`case=${evaluationCase.id} result=error latency_ms=${latencyMs}`);
    }
  }

  const metrics = calculateEvaluationMetrics(results);
  write(`metrics=${JSON.stringify(metrics)}`);
  return { metrics, exitCode: metrics.accepted ? 0 : 1 };
};
