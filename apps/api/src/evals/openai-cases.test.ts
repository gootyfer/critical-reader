import {
  AnalyzeRequestSchema,
  AnalyzeResponseSchema,
} from "@critical-reader/contracts";
import { describe, expect, it } from "vitest";

import { OPENAI_EVALUATION_CASES } from "./openai-cases.js";

describe("OPENAI_EVALUATION_CASES", () => {
  it("freezes sixteen uniquely identified, contract-valid cases", () => {
    expect(OPENAI_EVALUATION_CASES).toHaveLength(16);
    expect(new Set(OPENAI_EVALUATION_CASES.map(({ id }) => id)).size).toBe(16);

    for (const evaluationCase of OPENAI_EVALUATION_CASES) {
      expect(AnalyzeRequestSchema.safeParse(evaluationCase.request).success).toBe(
        true,
      );
      expect(
        AnalyzeResponseSchema.safeParse(evaluationCase.expected).success,
      ).toBe(true);
    }
  });

  it("combines twelve synthetic cases with four traceable real articles", () => {
    const realCases = OPENAI_EVALUATION_CASES.filter(
      ({ source }) => source?.kind === "real",
    );

    expect(realCases.map(({ id, source }) => ({ id, source }))).toEqual([
      {
        id: "real_elespanol_sexism_biological_generalization",
        source: {
          kind: "real",
          outlet: "El Español",
          url: "https://www.elespanol.com/opinion/columnas/20220116/sexo-politica-mujeres-conservadoras-hombres-progresistas/642565759_13.html",
        },
      },
      {
        id: "real_elespanol_xenophobia_national_belonging",
        source: {
          kind: "real",
          outlet: "El Español",
          url: "https://www.elespanol.com/opinion/columnas/20260501/espana-cacho-tierra/1003744228645_12.html",
        },
      },
      {
        id: "real_okdiario_homophobia_diversity_framing",
        source: {
          kind: "real",
          outlet: "OKDIARIO",
          url: "https://okdiario.com/opinion/que-orgullo-hablamos-2549470/amp",
        },
      },
      {
        id: "real_larazon_negative_attributed_survey",
        source: {
          kind: "real",
          outlet: "La Razón",
          url: "https://www.larazon.es/comunidad-valenciana/20200624/ki7fu2kmfff7laq3iv5ivyruhy.html",
        },
      },
    ]);

    expect(
      OPENAI_EVALUATION_CASES.filter(({ source }) => source === undefined),
    ).toHaveLength(12);

    expect(realCases.map(({ expected }) => expected.findings[0]?.category)).toEqual(
      [
        "sexism",
        "racism_xenophobia",
        "homophobia_transphobia",
        undefined,
      ],
    );
  });

  it("keeps two synthetic positive cases for each category", () => {
    const categories = OPENAI_EVALUATION_CASES.filter(
      ({ source }) => source === undefined,
    ).flatMap(({ expected }) =>
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

  it("keeps three attributed and three contextual synthetic negatives", () => {
    const negativeIds = OPENAI_EVALUATION_CASES.filter(
      ({ expected, source }) =>
        source === undefined && expected.findings.length === 0,
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
