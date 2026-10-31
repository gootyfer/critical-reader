import { describe, expect, it } from "vitest";

import {
  AnalyzeRequestSchema,
  AnalyzeResponseSchema,
  MAX_PARAGRAPHS,
  MAX_TOTAL_CHARACTERS,
} from "./index.js";

describe("AnalyzeRequestSchema", () => {
  const minimalRequest = {
    title: "",
    subtitle: "",
    language: "es" as const,
    paragraphs: [{ id: "p0", text: "Contenido." }],
  };

  it("accepts a valid Spanish article", () => {
    const result = AnalyzeRequestSchema.safeParse({
      title: "Un artículo",
      subtitle: "",
      language: "es",
      paragraphs: [{ id: "p0", text: "Contenido del artículo." }],
    });

    expect(result.success).toBe(true);
  });

  it("rejects duplicate paragraph identifiers", () => {
    const result = AnalyzeRequestSchema.safeParse({
      title: "Un artículo",
      subtitle: "",
      language: "es",
      paragraphs: [
        { id: "p0", text: "Primer párrafo." },
        { id: "p0", text: "Segundo párrafo." },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects empty paragraph text after trimming", () => {
    const result = AnalyzeRequestSchema.safeParse({
      title: "Un artículo",
      subtitle: "",
      language: "es",
      paragraphs: [{ id: "p0", text: "  \n  " }],
    });

    expect(result.success).toBe(false);
  });

  it("rejects more than the maximum number of paragraphs", () => {
    const result = AnalyzeRequestSchema.safeParse({
      title: "Un artículo",
      subtitle: "",
      language: "es",
      paragraphs: Array.from({ length: MAX_PARAGRAPHS + 1 }, (_, index) => ({
        id: `p${index}`,
        text: "Contenido.",
      })),
    });

    expect(result.success).toBe(false);
  });

  it("accepts the total character limit and rejects one character more", () => {
    const baseRequest = {
      title: "a".repeat(2_000),
      subtitle: "b".repeat(4_000),
      language: "es" as const,
      paragraphs: Array.from({ length: 5 }, (_, index) => ({
        id: `p${index}`,
        text: "c".repeat((MAX_TOTAL_CHARACTERS - 6_000) / 5),
      })),
    };

    expect(AnalyzeRequestSchema.safeParse(baseRequest).success).toBe(true);
    expect(
      AnalyzeRequestSchema.safeParse({
        ...baseRequest,
        paragraphs: baseRequest.paragraphs.map((paragraph, index) =>
          index === 0
            ? { ...paragraph, text: `${paragraph.text}c` }
            : paragraph,
        ),
      }).success,
    ).toBe(false);
  });

  it.each([
    [
      "title",
      { ...minimalRequest, title: "a".repeat(2_000) },
      { ...minimalRequest, title: "a".repeat(2_001) },
    ],
    [
      "subtitle",
      { ...minimalRequest, subtitle: "a".repeat(4_000) },
      { ...minimalRequest, subtitle: "a".repeat(4_001) },
    ],
    [
      "paragraph identifier",
      {
        ...minimalRequest,
        paragraphs: [{ id: "a".repeat(100), text: "Contenido." }],
      },
      {
        ...minimalRequest,
        paragraphs: [{ id: "a".repeat(101), text: "Contenido." }],
      },
    ],
    [
      "paragraph text",
      {
        ...minimalRequest,
        paragraphs: [{ id: "p0", text: "a".repeat(20_000) }],
      },
      {
        ...minimalRequest,
        paragraphs: [{ id: "p0", text: "a".repeat(20_001) }],
      },
    ],
  ])("enforces the %s length boundary", (_field, atLimit, overLimit) => {
    expect(AnalyzeRequestSchema.safeParse(atLimit).success).toBe(true);
    expect(AnalyzeRequestSchema.safeParse(overLimit).success).toBe(false);
  });
});

describe("AnalyzeResponseSchema", () => {
  const validFinding = {
    paragraphId: "p0",
    category: "sexism" as const,
    mechanism: "stereotype" as const,
    explanation: "Generaliza una capacidad a partir del género.",
  };

  it("accepts a supported finding", () => {
    const result = AnalyzeResponseSchema.safeParse({
      findings: [
        {
          paragraphId: "p0",
          category: "sexism",
          mechanism: "stereotype",
          explanation: "Generaliza una capacidad a partir del género.",
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it.each([
    ["unsupported category", { category: "ageism" }],
    ["unsupported mechanism", { mechanism: "insult" }],
    ["empty explanation", { explanation: "   " }],
  ])("rejects an %s", (_case, override) => {
    const result = AnalyzeResponseSchema.safeParse({
      findings: [
        {
          paragraphId: "p0",
          category: "sexism",
          mechanism: "stereotype",
          explanation: "Generaliza una capacidad a partir del género.",
          ...override,
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it.each([
    [
      "paragraph identifier",
      { ...validFinding, paragraphId: "a".repeat(100) },
      { ...validFinding, paragraphId: "a".repeat(101) },
    ],
    [
      "explanation",
      { ...validFinding, explanation: "a".repeat(500) },
      { ...validFinding, explanation: "a".repeat(501) },
    ],
  ])("enforces the finding %s length boundary", (_field, atLimit, overLimit) => {
    expect(AnalyzeResponseSchema.safeParse({ findings: [atLimit] }).success).toBe(
      true,
    );
    expect(
      AnalyzeResponseSchema.safeParse({ findings: [overLimit] }).success,
    ).toBe(false);
  });

  it("enforces the findings count boundary", () => {
    expect(
      AnalyzeResponseSchema.safeParse({
        findings: Array.from({ length: MAX_PARAGRAPHS }, () => validFinding),
      }).success,
    ).toBe(true);
    expect(
      AnalyzeResponseSchema.safeParse({
        findings: Array.from({ length: MAX_PARAGRAPHS + 1 }, () => validFinding),
      }).success,
    ).toBe(false);
  });
});
