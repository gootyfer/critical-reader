import { describe, expect, it } from "vitest";

import type { AnalyzeRequest } from "@critical-reader/contracts";

import { FakeArticleAnalyzer } from "./fake-analyzer.js";

function articleWith(...paragraphs: string[]): AnalyzeRequest {
  return {
    title: "Artículo de prueba",
    subtitle: "",
    language: "es",
    paragraphs: paragraphs.map((text, index) => ({ id: `p${index}`, text })),
  };
}

describe("FakeArticleAnalyzer", () => {
  const analyzer = new FakeArticleAnalyzer();

  it.each([
    {
      text: "Las mujeres no deberían ocupar puestos técnicos.",
      category: "sexism",
      mechanism: "stereotype",
    },
    {
      text: "Las personas inmigrantes son inferiores.",
      category: "racism_xenophobia",
      mechanism: "dehumanization",
    },
    {
      text: "Las parejas homosexuales no deberían tener los mismos derechos.",
      category: "homophobia_transphobia",
      mechanism: "exclusion",
    },
  ] as const)("detects clear $category content", async ({ text, category, mechanism }) => {
    const result = await analyzer.analyze(articleWith(text));

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({
      paragraphId: "p0",
      category,
      mechanism,
    });
    expect(result.findings[0]?.explanation).not.toHaveLength(0);
  });

  it.each([
    "El portavoz afirmó: «Las mujeres no deberían ocupar puestos técnicos».",
    "Según el entrevistado, las personas inmigrantes son inferiores.",
    "Dijo que las parejas homosexuales no deberían tener los mismos derechos.",
    'El texto decía: "Las mujeres no deberían ocupar puestos técnicos".',
  ])("does not flag quoted or attributed speech: %s", async (text) => {
    await expect(analyzer.analyze(articleWith(text))).resolves.toEqual({
      findings: [],
    });
  });

  it("does not flag neutral or merely related content", async () => {
    const result = await analyzer.analyze(
      articleWith(
        "La empresa revisará sus criterios de selección.",
        "El artículo analiza la desigualdad entre mujeres y hombres.",
        "Una asociación defendió los mismos derechos para todas las parejas.",
      ),
    );

    expect(result).toEqual({ findings: [] });
  });

  it("keeps the identifier of each matched paragraph", async () => {
    const result = await analyzer.analyze(
      articleWith(
        "Las mujeres no deberían ocupar puestos técnicos.",
        "Un párrafo neutral.",
        "Las personas inmigrantes son inferiores.",
      ),
    );

    expect(result.findings.map(({ paragraphId }) => paragraphId)).toEqual([
      "p0",
      "p2",
    ]);
  });
});
