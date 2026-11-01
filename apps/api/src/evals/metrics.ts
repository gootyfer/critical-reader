import type { AnalyzeResponse } from "@critical-reader/contracts";

export interface EvaluationResult {
  expected: AnalyzeResponse;
  actual: AnalyzeResponse | null;
}

export interface EvaluationMetrics {
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  positiveCasesDetected: number;
  negativeCasesWithFalsePositives: number;
  failedCases: number;
  accepted: boolean;
}

const findingKey = ({
  paragraphId,
  category,
}: AnalyzeResponse["findings"][number]): string => `${paragraphId}:${category}`;

export const calculateEvaluationMetrics = (
  results: readonly EvaluationResult[],
): EvaluationMetrics => {
  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  let positiveCasesDetected = 0;
  let negativeCasesWithFalsePositives = 0;
  let failedCases = 0;

  for (const result of results) {
    const expected = new Set(result.expected.findings.map(findingKey));
    const actual = new Set((result.actual?.findings ?? []).map(findingKey));

    if (result.actual === null) failedCases += 1;

    const matched = [...expected].filter((key) => actual.has(key)).length;
    truePositives += matched;
    falseNegatives += expected.size - matched;
    falsePositives += [...actual].filter((key) => !expected.has(key)).length;

    if (expected.size > 0 && matched > 0) positiveCasesDetected += 1;
    if (expected.size === 0 && actual.size > 0) {
      negativeCasesWithFalsePositives += 1;
    }
  }

  const predictedPositives = truePositives + falsePositives;
  const expectedPositives = truePositives + falseNegatives;
  const precision =
    predictedPositives === 0 ? 1 : truePositives / predictedPositives;
  const recall = expectedPositives === 0 ? 1 : truePositives / expectedPositives;
  const accepted =
    failedCases === 0 &&
    falsePositives === 0 &&
    positiveCasesDetected >= 5;

  return {
    truePositives,
    falsePositives,
    falseNegatives,
    precision,
    recall,
    positiveCasesDetected,
    negativeCasesWithFalsePositives,
    failedCases,
    accepted,
  };
};
