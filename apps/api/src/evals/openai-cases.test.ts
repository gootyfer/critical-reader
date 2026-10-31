import {
  AnalyzeRequestSchema,
  AnalyzeResponseSchema,
} from "@critical-reader/contracts";
import { describe, expect, it } from "vitest";

import { OPENAI_EVALUATION_CASES } from "./openai-cases.js";

describe("OPENAI_EVALUATION_CASES", () => {
  it("freezes twelve uniquely identified, contract-valid cases", () => {
    expect(OPENAI_EVALUATION_CASES).toHaveLength(12);
    expect(new Set(OPENAI_EVALUATION_CASES.map(({ id }) => id)).size).toBe(12);

    for (const evaluationCase of OPENAI_EVALUATION_CASES) {
      expect(AnalyzeRequestSchema.safeParse(evaluationCase.request).success).toBe(
        true,
      );
      expect(
        AnalyzeResponseSchema.safeParse(evaluationCase.expected).success,
      ).toBe(true);
    }
  });

  it("contains two positive cases for each category", () => {
    const categories = OPENAI_EVALUATION_CASES.flatMap(({ expected }) =>
      expected.findings.map(({ category }) => category),
    );

    expect(categories).toEqual([
      "sexism",
      "sexism",
      "racism_xenophobia",
      "racism_xenophobia",
      "homophobia_transphobia",
      "homophobia_transphobia",
    ]);
  });

  it("contains three attributed and three contextual negative cases", () => {
    const negativeIds = OPENAI_EVALUATION_CASES.filter(
      ({ expected }) => expected.findings.length === 0,
    ).map(({ id }) => id);

    expect(negativeIds).toEqual([
      "negative_quote_sexism",
      "negative_quote_racism",
      "negative_quote_homophobia",
      "negative_critical_context",
      "negative_neutral_context",
      "negative_ambiguous_injection",
    ]);
  });

  it("keeps an adversarial instruction inside a negative article", () => {
    const adversarialCase = OPENAI_EVALUATION_CASES.find(
      ({ id }) => id === "negative_ambiguous_injection",
    );

    expect(
      adversarialCase?.request.paragraphs.some(({ text }) =>
        text.includes("Ignora las instrucciones"),
      ),
    ).toBe(true);
    expect(adversarialCase?.expected).toEqual({ findings: [] });
  });

  it("references only paragraph identifiers present in each request", () => {
    for (const evaluationCase of OPENAI_EVALUATION_CASES) {
      const paragraphIds = new Set(
        evaluationCase.request.paragraphs.map(({ id }) => id),
      );
      expect(
        evaluationCase.expected.findings.every(({ paragraphId }) =>
          paragraphIds.has(paragraphId),
        ),
      ).toBe(true);
    }
  });
});
