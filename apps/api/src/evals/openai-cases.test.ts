import {
  AnalyzeRequestSchema,
  AnalyzeResponseSchema,
} from "../contracts.js";
import { describe, expect, it } from "vitest";

import { OPENAI_EVALUATION_CASES } from "./openai-cases.js";

describe("OPENAI_EVALUATION_CASES", () => {
  it("freezes twenty-one uniquely identified, contract-valid cases", () => {
    expect(OPENAI_EVALUATION_CASES).toHaveLength(21);
    expect(new Set(OPENAI_EVALUATION_CASES.map(({ id }) => id)).size).toBe(21);

    for (const evaluationCase of OPENAI_EVALUATION_CASES) {
      expect(AnalyzeRequestSchema.safeParse(evaluationCase.request).success).toBe(
        true,
      );
      expect(
        AnalyzeResponseSchema.safeParse(evaluationCase.expected).success,
      ).toBe(true);
    }
  });

  it("combines thirteen synthetic cases with eight traceable real articles", () => {
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
      {
        id: "real_eldiario_negative_attributed_vox_subsidies",
        source: {
          kind: "real",
          outlet: "elDiario.es",
          url: "https://www.eldiario.es/aragon/sociedad/gobierno-central-eleva-ayudas-programas-sociales-aragon-vox-plantea-retirar-fondos-ong_1_13626729.html",
        },
      },
      {
        id: "real_elpais_negative_judicial_context",
        source: {
          kind: "real",
          outlet: "El País",
          url: "https://elpais.com/espana/2026-10-28/temor-a-la-tribu-maltrato-homosexual-obligaciones-militares-la-justicia-rechaza-45-solicitudes-de-proteccion-urgente.html",
        },
      },
      {
        id: "real_elespanol_negative_critical_feminism",
        source: {
          kind: "real",
          outlet: "El Español",
          url: "https://www.elespanol.com/valencia/opinion/20261030/madre-feministas/1003744440295_13.html",
        },
      },
      {
        id: "real_eldiario_negative_critical_racism",
        source: {
          kind: "real",
          outlet: "elDiario.es",
          url: "https://www.eldiario.es/aragon/el-prismatico/machismo-fronteras-racismo-responsables_132_13615402.html",
        },
      },
    ]);

    expect(
      OPENAI_EVALUATION_CASES.filter(({ source }) => source === undefined),
    ).toHaveLength(13);

    expect(realCases.map(({ expected }) => expected.findings[0]?.category)).toEqual(
      [
        "sexism",
        "racism_xenophobia",
        "homophobia_transphobia",
        undefined,
        undefined,
        undefined,
        undefined,
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

  it("keeps four attributed and three contextual synthetic negatives", () => {
    const negativeIds = OPENAI_EVALUATION_CASES.filter(
      ({ expected, source }) =>
        source === undefined && expected.findings.length === 0,
    ).map(({ id }) => id);

    expect(negativeIds).toEqual([
      "negative_quote_sexism",
      "negative_quote_racism",
      "negative_quote_homophobia",
      "negative_indirect_attribution",
      "negative_critical_context",
      "negative_neutral_context",
      "negative_ambiguous_injection",
    ]);
  });

  it("freezes the reported Vox subsidies paragraph as a negative attribution", () => {
    const evaluationCase = OPENAI_EVALUATION_CASES.find(
      ({ id }) => id === "real_eldiario_negative_attributed_vox_subsidies",
    );

    expect(evaluationCase?.request.paragraphs).toContainEqual({
      id: "p1",
      text: "La posición de Vox se ha traducido ya en una modificación concreta de las subvenciones autonómicas. El pasado 2 de octubre, el departamento de Nolasco publicó una convocatoria que eliminaba la línea específica de apoyo a personas LGTBI y sus familias, dotada con 161.000 euros en 2025, y concentraba los 516.000 euros disponibles en proyectos dirigidos a personas con discapacidad.",
    });
    expect(evaluationCase?.expected).toEqual({ findings: [] });
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
