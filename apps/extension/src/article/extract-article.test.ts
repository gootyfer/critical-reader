// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { extractArticle } from "./extract-article.js";

describe("extractArticle", () => {
  it("prefers the article root and maps normalized paragraphs to their elements", () => {
    document.head.innerHTML = "<title>Título de respaldo</title>";
    document.body.innerHTML = `
      <main><p>Este párrafo de main debe quedar fuera.</p></main>
      <article>
        <header>
          <h1>  Título   principal  </h1>
          <h2 class="subtitle"> Subtítulo del artículo </h2>
        </header>
        <p> Primer   párrafo. </p>
        <p>Segundo\n párrafo.</p>
      </article>
      <p>Este párrafo de body también debe quedar fuera.</p>
    `;

    const paragraphs = [...document.querySelectorAll("article p")];
    const result = extractArticle(document);

    expect(result?.request).toEqual({
      title: "Título principal",
      subtitle: "Subtítulo del artículo",
      language: "es",
      paragraphs: [
        { id: "p0", text: "Primer párrafo." },
        { id: "p1", text: "Segundo párrafo." },
      ],
    });
    expect(result?.elementsByParagraphId.get("p0")).toBe(paragraphs[0]);
    expect(result?.elementsByParagraphId.get("p1")).toBe(paragraphs[1]);
  });

  it("falls back to body and excludes empty or hidden paragraphs", () => {
    document.head.innerHTML = "<title>Documento sin artículo</title>";
    document.body.innerHTML = `
      <p>   </p>
      <p hidden>Oculto con hidden.</p>
      <p aria-hidden="true">Oculto para accesibilidad.</p>
      <p style="display: none">Oculto con display.</p>
      <p style="visibility: hidden">Oculto con visibility.</p>
      <p>Párrafo visible.</p>
    `;

    expect(extractArticle(document)?.request).toEqual({
      title: "Documento sin artículo",
      subtitle: "",
      language: "es",
      paragraphs: [{ id: "p0", text: "Párrafo visible." }],
    });
  });

  it("returns null when there are no analyzable paragraphs", () => {
    document.body.innerHTML = "<article><h1>Solo un título</h1></article>";

    expect(extractArticle(document)).toBeNull();
  });

  it("keeps complete paragraphs within the paragraph count limit", () => {
    document.body.innerHTML = `<article>${Array.from(
      { length: 201 },
      (_, index) => `<p>Párrafo ${index}.</p>`,
    ).join("")}</article>`;

    const result = extractArticle(document);

    expect(result?.request.paragraphs).toHaveLength(200);
    expect(result?.request.paragraphs.at(-1)).toEqual({
      id: "p199",
      text: "Párrafo 199.",
    });
  });

  it("stops before a complete paragraph would exceed the character limit", () => {
    document.head.innerHTML = "<title></title>";
    document.body.innerHTML = `<article>${Array.from(
      { length: 6 },
      (_, index) => `<p>${String(index).repeat(20_000)}</p>`,
    ).join("")}</article>`;

    const result = extractArticle(document);

    expect(result?.request.paragraphs).toHaveLength(5);
    expect(result?.request.paragraphs[4]?.text).toHaveLength(20_000);
    expect(result?.elementsByParagraphId.has("p5")).toBe(false);
  });

  it("truncates metadata so the resulting request remains contract-valid", () => {
    document.body.innerHTML = `
      <article>
        <h1>${"t".repeat(2_001)}</h1>
        <h2 class="subtitle">${"s".repeat(4_001)}</h2>
        <p>Contenido.</p>
      </article>
    `;

    const result = extractArticle(document);

    expect(result?.request.title).toHaveLength(2_000);
    expect(result?.request.subtitle).toHaveLength(4_000);
  });
});
