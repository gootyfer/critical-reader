import { describe, expect, it } from "vitest";

import type { AnalyzeRequest } from "../contracts.js";

import { createContentHash } from "./content-hash.js";

const article: AnalyzeRequest = {
  title: "Título",
  subtitle: "Subtítulo",
  language: "es",
  paragraphs: [
    { id: "p0", text: "Primer párrafo." },
    { id: "p1", text: "Segundo párrafo." },
  ],
};

describe("createContentHash", () => {
  it("ignores paragraph identifiers and insignificant whitespace", () => {
    const equivalentArticle: AnalyzeRequest = {
      ...article,
      title: "  Título ",
      paragraphs: [
        { id: "different-1", text: "Primer   párrafo." },
        { id: "different-2", text: "Segundo párrafo.\n" },
      ],
    };

    expect(createContentHash(equivalentArticle)).toBe(createContentHash(article));
  });

  it("changes when article content changes", () => {
    const changedArticle: AnalyzeRequest = {
      ...article,
      paragraphs: [{ id: "p0", text: "Contenido diferente." }],
    };

    expect(createContentHash(changedArticle)).not.toBe(createContentHash(article));
  });

  it("normalizes canonically equivalent Unicode", () => {
    const decomposedArticle: AnalyzeRequest = {
      ...article,
      title: "Ti\u0301tulo",
    };

    expect(createContentHash(decomposedArticle)).toBe(createContentHash(article));
  });

  it.each([
    ["title", { ...article, title: "Otro título" }],
    ["subtitle", { ...article, subtitle: "Otro subtítulo" }],
    [
      "paragraph order",
      { ...article, paragraphs: [...article.paragraphs].reverse() },
    ],
  ] as const)("changes when %s changes", (_field, changedArticle) => {
    expect(createContentHash(changedArticle)).not.toBe(createContentHash(article));
  });

  it("returns a SHA-256 hexadecimal digest", () => {
    expect(createContentHash(article)).toMatch(/^[a-f0-9]{64}$/u);
  });
});
