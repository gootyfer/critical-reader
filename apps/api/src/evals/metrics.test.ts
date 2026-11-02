import type { AnalyzeResponse, Finding } from "../contracts.js";
import { describe, expect, it } from "vitest";

import {
  calculateEvaluationMetrics,
  type EvaluationResult,
} from "./metrics.js";

const finding = (
  paragraphId: string,
  category: Finding["category"] = "sexism",
): Finding => ({
  paragraphId,
  category,
  mechanism: "stereotype",
  explanation: "Referencia de prueba.",
});

const response = (...findings: Finding[]): AnalyzeResponse => ({ findings });

const fiveOfSixDetected: EvaluationResult[] = [
  { expected: response(finding("p1")), actual: response(finding("p1")) },
  { expected: response(finding("p2")), actual: response(finding("p2")) },
  { expected: response(finding("p3")), actual: response(finding("p3")) },
  { expected: response(finding("p4")), actual: response(finding("p4")) },
  { expected: response(finding("p5")), actual: response(finding("p5")) },
  { expected: response(finding("p6")), actual: response() },
  { expected: response(), actual: response() },
  { expected: response(), actual: response() },
  { expected: response(), actual: response() },
  { expected: response(), actual: response() },
  { expected: response(), actual: response() },
  { expected: response(), actual: response() },
];

describe("calculateEvaluationMetrics", () => {
  it("counts matches and accepts five of six positives with no false positives", () => {
    expect(calculateEvaluationMetrics(fiveOfSixDetected)).toEqual({
      truePositives: 5,
      falsePositives: 0,
      falseNegatives: 1,
      precision: 1,
      recall: 5 / 6,
      positiveCasesDetected: 5,
      negativeCasesWithFalsePositives: 0,
      failedCases: 0,
      accepted: true,
    });
  });

  it("rejects a run with any false positive", () => {
    const results = fiveOfSixDetected.map((result) => ({ ...result }));
    results[6] = {
      expected: response(),
      actual: response(finding("unexpected", "racism_xenophobia")),
    };

    expect(calculateEvaluationMetrics(results)).toMatchObject({
      truePositives: 5,
      falsePositives: 1,
      falseNegatives: 1,
      precision: 5 / 6,
      negativeCasesWithFalsePositives: 1,
      accepted: false,
    });
  });

  it("rejects fewer than five detected positive cases", () => {
    const results = fiveOfSixDetected.map((result) => ({ ...result }));
    results[4] = { expected: response(finding("p5")), actual: response() };

    expect(calculateEvaluationMetrics(results)).toMatchObject({
      truePositives: 4,
      falsePositives: 0,
      falseNegatives: 2,
      positiveCasesDetected: 4,
      accepted: false,
    });
  });

  it("rejects more than one missed positive when the corpus grows", () => {
    const results: EvaluationResult[] = [
      ...fiveOfSixDetected.slice(0, 5),
      { expected: response(finding("p6")), actual: response(finding("p6")) },
      { expected: response(finding("p7")), actual: response(finding("p7")) },
      { expected: response(finding("p8")), actual: response() },
      { expected: response(finding("p9")), actual: response() },
      { expected: response(), actual: response() },
    ];

    expect(calculateEvaluationMetrics(results)).toMatchObject({
      positiveCasesDetected: 7,
      falseNegatives: 2,
      accepted: false,
    });
  });

  it("counts provider failures as failed and unacceptable cases", () => {
    const results = fiveOfSixDetected.map((result) => ({ ...result }));
    results[0] = { expected: response(finding("p1")), actual: null };

    expect(calculateEvaluationMetrics(results)).toMatchObject({
      failedCases: 1,
      falseNegatives: 2,
      accepted: false,
    });
  });
});
