// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import type { AnalyzeResponse } from "@critical-reader/contracts";

import type { ExtractedArticle } from "../article/extract-article.js";
import { createReaderUi } from "./reader-ui.js";

const response: AnalyzeResponse = {
  findings: [
    {
      paragraphId: "p0",
      category: "sexism",
      mechanism: "stereotype",
      explanation: "Atribuye una incapacidad a las mujeres como grupo.",
    },
    {
      paragraphId: "unknown",
      category: "racism_xenophobia",
      mechanism: "exclusion",
      explanation: "Este finding no tiene elemento.",
    },
  ],
};

function extractedArticle(): ExtractedArticle {
  const first = document.querySelector<HTMLParagraphElement>("#first");
  const second = document.querySelector<HTMLParagraphElement>("#second");

  if (!first || !second) {
    throw new Error("Test paragraphs are missing");
  }

  return {
    request: {
      title: "Artículo",
      subtitle: "",
      language: "es",
      paragraphs: [
        { id: "p0", text: first.textContent ?? "" },
        { id: "p1", text: second.textContent ?? "" },
      ],
    },
    elementsByParagraphId: new Map([
      ["p0", first],
      ["p1", second],
    ]),
  };
}

function popover() {
  const host = document.querySelector<HTMLElement>(
    "[data-critical-reader-host]",
  );
  const element = host?.shadowRoot?.querySelector<HTMLElement>(
    "[role='tooltip']",
  );

  if (!element) {
    throw new Error("Popover is missing");
  }

  return element;
}

beforeEach(() => {
  document.body.innerHTML = `
    <article>
      <p id="first" style="color: navy">Las <em>mujeres</em> no deberían ocupar puestos técnicos.</p>
      <p id="second">Un párrafo neutral.</p>
    </article>
  `;
});

describe("createReaderUi", () => {
  it("highlights only known findings without replacing paragraph content", () => {
    const first = document.querySelector<HTMLParagraphElement>("#first")!;
    const second = document.querySelector<HTMLParagraphElement>("#second")!;
    const originalHtml = first.innerHTML;
    const ui = createReaderUi(document);

    ui.renderFindings(extractedArticle(), response);

    expect(first.innerHTML).toBe(originalHtml);
    expect(first.dataset.criticalReaderHighlight).toBe("true");
    expect(first.style.backgroundColor).toBe("rgba(255, 221, 64, 0.45)");
    expect(first.tabIndex).toBe(0);
    expect(first.getAttribute("aria-haspopup")).toBeNull();
    expect(first.getAttribute("aria-describedby")).toBeTruthy();
    expect(second.dataset.criticalReaderHighlight).toBeUndefined();
    expect(
      document.querySelectorAll("[data-critical-reader-highlight]"),
    ).toHaveLength(1);
  });

  it("shows translated details on hover and hides them on mouseleave", () => {
    const first = document.querySelector<HTMLParagraphElement>("#first")!;
    const ui = createReaderUi(document);
    ui.renderFindings(extractedArticle(), response);

    first.dispatchEvent(new MouseEvent("mouseenter"));

    expect(popover().id).toBe("critical-reader-popover");
    expect(popover().hidden).toBe(false);
    expect(popover().textContent).toContain("Machismo");
    expect(popover().textContent).toContain("Estereotipo");
    expect(popover().textContent).toContain(
      "Atribuye una incapacidad a las mujeres como grupo.",
    );

    first.dispatchEvent(new MouseEvent("mouseleave"));
    expect(popover().hidden).toBe(true);
  });

  it("supports focus, click pinning, Escape and outside clicks", () => {
    const first = document.querySelector<HTMLParagraphElement>("#first")!;
    const second = document.querySelector<HTMLParagraphElement>("#second")!;
    const ui = createReaderUi(document);
    ui.renderFindings(extractedArticle(), response);

    first.dispatchEvent(new FocusEvent("focus"));
    expect(popover().hidden).toBe(false);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(popover().hidden).toBe(true);

    first.click();
    first.dispatchEvent(new MouseEvent("mouseleave"));
    expect(popover().hidden).toBe(false);
    expect(first.getAttribute("aria-expanded")).toBe("true");

    second.click();
    expect(popover().hidden).toBe(true);
    expect(first.getAttribute("aria-expanded")).toBe("false");
  });

  it("associates an accessible light-DOM description with the paragraph", () => {
    const first = document.querySelector<HTMLParagraphElement>("#first")!;
    const ui = createReaderUi(document);
    ui.renderFindings(extractedArticle(), response);

    const descriptionId = first.getAttribute("aria-describedby");
    const description = descriptionId
      ? document.getElementById(descriptionId)
      : null;

    expect(description).not.toBeNull();
    expect(description?.textContent).toContain("Machismo");
    expect(description?.textContent).toContain("Estereotipo");
    expect(description?.textContent).toContain(
      "Atribuye una incapacidad a las mujeres como grupo.",
    );
  });

  it("reports loading, errors and an empty result inside the shadow UI", () => {
    const ui = createReaderUi(document);
    const host = document.querySelector<HTMLElement>(
      "[data-critical-reader-host]",
    )!;
    const status = host.shadowRoot?.querySelector<HTMLElement>("#status")!;
    const statusMessage = host.shadowRoot?.querySelector<HTMLElement>(
      "#status-message",
    )!;

    ui.showLoading();
    expect(statusMessage.textContent).toBe("Analizando este artículo…");
    expect(status.hidden).toBe(false);

    ui.showError("No se pudo conectar con el servidor local.");
    expect(statusMessage.textContent).toBe(
      "No se pudo conectar con el servidor local.",
    );

    ui.renderFindings(extractedArticle(), { findings: [] });
    expect(statusMessage.textContent).toBe(
      "No se detectaron expresiones claras.",
    );
  });

  it("lets users dismiss status notices and shows future notices again", () => {
    const ui = createReaderUi(document);
    const host = document.querySelector<HTMLElement>(
      "[data-critical-reader-host]",
    )!;
    const status = host.shadowRoot?.querySelector<HTMLElement>("#status")!;
    const closeButton = host.shadowRoot?.querySelector<HTMLButtonElement>(
      "button[aria-label='Cerrar aviso']",
    );

    ui.renderFindings(extractedArticle(), { findings: [] });
    expect(closeButton).not.toBeNull();

    closeButton?.click();
    expect(status.hidden).toBe(true);

    ui.showError("Nuevo aviso");
    expect(status.hidden).toBe(false);
    expect(status.textContent).toContain("Nuevo aviso");
  });

  it("removes its host and restores paragraph attributes on destroy", () => {
    const first = document.querySelector<HTMLParagraphElement>("#first")!;
    const originalStyle = first.getAttribute("style");
    const ui = createReaderUi(document);
    ui.renderFindings(extractedArticle(), response);

    ui.destroy();

    expect(document.querySelector("[data-critical-reader-host]")).toBeNull();
    expect(first.getAttribute("style")).toBe(originalStyle);
    expect(first.hasAttribute("data-critical-reader-highlight")).toBe(false);
    expect(first.hasAttribute("tabindex")).toBe(false);
    expect(first.hasAttribute("aria-expanded")).toBe(false);
    expect(first.hasAttribute("aria-describedby")).toBe(false);
    expect(document.querySelector("[data-critical-reader-description]")).toBeNull();
  });

  it("ignores a late response after the UI has been destroyed", () => {
    const first = document.querySelector<HTMLParagraphElement>("#first")!;
    const ui = createReaderUi(document);
    const extracted = extractedArticle();

    ui.destroy();
    ui.renderFindings(extracted, response);

    expect(first.hasAttribute("data-critical-reader-highlight")).toBe(false);
    expect(document.querySelector("[data-critical-reader-host]")).toBeNull();
  });

  it("keeps a single shadow host when the UI is created again", () => {
    createReaderUi(document);
    createReaderUi(document);

    expect(document.querySelectorAll("[data-critical-reader-host]")).toHaveLength(
      1,
    );
  });
});
