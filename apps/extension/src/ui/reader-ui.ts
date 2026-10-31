import type { AnalyzeResponse, Finding } from "@critical-reader/contracts";

import type { ExtractedArticle } from "../article/extract-article.js";

const CATEGORY_LABELS: Record<Finding["category"], string> = {
  sexism: "Machismo",
  racism_xenophobia: "Racismo o xenofobia",
  homophobia_transphobia: "Homofobia o transfobia",
};

const MECHANISM_LABELS: Record<Finding["mechanism"], string> = {
  slur: "Insulto discriminatorio",
  stereotype: "Estereotipo",
  generalization: "Generalización",
  objectification: "Cosificación",
  paternalism: "Paternalismo",
  victim_blaming: "Culpabilización de la víctima",
  dehumanization: "Deshumanización",
  exclusion: "Exclusión",
  other_discriminatory_framing: "Encuadre discriminatorio",
};

const HOST_ATTRIBUTE = "data-critical-reader-host";
const HIGHLIGHT_ATTRIBUTE = "data-critical-reader-highlight";

type RestoredAttribute = string | null;

interface HighlightRecord {
  element: HTMLParagraphElement;
  description: HTMLElement;
  attributes: Record<string, RestoredAttribute>;
  removeListeners: () => void;
}

export interface ReaderUi {
  showLoading(): void;
  showError(message: string): void;
  renderFindings(
    extracted: ExtractedArticle,
    response: AnalyzeResponse,
  ): void;
  destroy(): void;
}

function restoreAttribute(
  element: HTMLElement,
  name: string,
  value: RestoredAttribute,
) {
  if (value === null) {
    element.removeAttribute(name);
  } else {
    element.setAttribute(name, value);
  }
}

export function createReaderUi(document: Document): ReaderUi {
  document.querySelector(`[${HOST_ATTRIBUTE}]`)?.remove();

  const host = document.createElement("div");
  host.setAttribute(HOST_ATTRIBUTE, "");
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      [hidden] { display: none !important; }
      #status, #critical-reader-popover {
        box-sizing: border-box;
        color: #202124;
        font: 14px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        position: fixed;
        z-index: 2147483647;
      }
      #status {
        background: #fffdf4;
        border: 1px solid #e4c441;
        border-radius: 8px;
        box-shadow: 0 4px 18px rgba(0, 0, 0, .18);
        max-width: min(360px, calc(100vw - 32px));
        padding: 10px 14px;
        right: 16px;
        top: 16px;
      }
      #critical-reader-popover {
        background: white;
        border: 1px solid #c8a900;
        border-radius: 10px;
        box-shadow: 0 8px 28px rgba(0, 0, 0, .24);
        max-width: min(360px, calc(100vw - 24px));
        padding: 12px 14px;
        width: max-content;
      }
      #critical-reader-popover strong { display: block; margin-bottom: 4px; }
      #critical-reader-popover p { margin: 6px 0 0; }
      #mechanism { color: #5f5200; font-size: 12px; }
    </style>
    <div id="status" role="status" aria-live="polite" hidden></div>
    <div id="critical-reader-popover" role="tooltip" hidden></div>
  `;
  document.documentElement.append(host);

  const status = shadow.querySelector<HTMLElement>("#status")!;
  const popover = shadow.querySelector<HTMLElement>(
    "#critical-reader-popover",
  )!;
  const highlightRecords: HighlightRecord[] = [];
  let activeElement: HTMLParagraphElement | null = null;
  let pinnedElement: HTMLParagraphElement | null = null;
  let destroyed = false;

  const hidePopover = () => {
    popover.hidden = true;
    activeElement?.setAttribute("aria-expanded", "false");
    activeElement = null;
    pinnedElement = null;
  };

  const showPopover = (
    element: HTMLParagraphElement,
    finding: Finding,
    pinned: boolean,
  ) => {
    if (activeElement && activeElement !== element) {
      activeElement.setAttribute("aria-expanded", "false");
    }

    const category = document.createElement("strong");
    category.textContent = CATEGORY_LABELS[finding.category];
    const mechanism = document.createElement("div");
    mechanism.id = "mechanism";
    mechanism.textContent = MECHANISM_LABELS[finding.mechanism];
    const explanation = document.createElement("p");
    explanation.textContent = finding.explanation;
    popover.replaceChildren(category, mechanism, explanation);

    const rect = element.getBoundingClientRect();
    const viewportWidth = document.defaultView?.innerWidth ?? 1_024;
    popover.style.left = `${Math.max(12, Math.min(rect.left, viewportWidth - 372))}px`;
    popover.style.top = `${Math.max(12, rect.bottom + 8)}px`;
    popover.hidden = false;
    activeElement = element;
    pinnedElement = pinned ? element : null;
    element.setAttribute("aria-expanded", "true");
  };

  const clearHighlights = () => {
    hidePopover();
    for (const record of highlightRecords.splice(0)) {
      record.removeListeners();
      record.description.remove();
      for (const [name, value] of Object.entries(record.attributes)) {
        restoreAttribute(record.element, name, value);
      }
    }
  };

  const onDocumentClick = (event: MouseEvent) => {
    const target = event.target;
    if (
      target instanceof Node &&
      (activeElement?.contains(target) || target === host || host.contains(target))
    ) {
      return;
    }

    hidePopover();
  };

  const onDocumentKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      hidePopover();
    }
  };

  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onDocumentKeydown);

  return {
    showLoading() {
      if (destroyed) {
        return;
      }

      status.textContent = "Analizando este artículo…";
      status.hidden = false;
    },

    showError(message) {
      if (destroyed) {
        return;
      }

      status.textContent = message;
      status.hidden = false;
    },

    renderFindings(extracted, response) {
      if (destroyed) {
        return;
      }

      clearHighlights();

      if (response.findings.length === 0) {
        status.textContent = "No se detectaron expresiones claras.";
        status.hidden = false;
        return;
      }

      status.hidden = true;

      for (const finding of response.findings) {
        const element = extracted.elementsByParagraphId.get(finding.paragraphId);
        if (!element) {
          continue;
        }

        const attributes: Record<string, RestoredAttribute> = {};
        for (const name of [
          "style",
          HIGHLIGHT_ATTRIBUTE,
          "tabindex",
          "aria-expanded",
          "aria-describedby",
        ]) {
          attributes[name] = element.getAttribute(name);
        }

        element.setAttribute(HIGHLIGHT_ATTRIBUTE, "true");
        element.style.backgroundColor = "rgba(255, 221, 64, 0.45)";
        element.style.borderRadius = "3px";
        element.style.cursor = "pointer";
        element.tabIndex = 0;
        element.setAttribute("aria-expanded", "false");

        const description = document.createElement("span");
        description.id = `critical-reader-description-${highlightRecords.length}`;
        description.setAttribute("data-critical-reader-description", "");
        description.textContent = `${CATEGORY_LABELS[finding.category]}. ${MECHANISM_LABELS[finding.mechanism]}. ${finding.explanation}`;
        Object.assign(description.style, {
          border: "0",
          clip: "rect(0 0 0 0)",
          height: "1px",
          margin: "-1px",
          overflow: "hidden",
          padding: "0",
          position: "absolute",
          whiteSpace: "nowrap",
          width: "1px",
        });
        (document.body ?? document.documentElement).append(description);

        const existingDescription = attributes["aria-describedby"];
        element.setAttribute(
          "aria-describedby",
          [existingDescription, description.id].filter(Boolean).join(" "),
        );

        const onMouseEnter = () => showPopover(element, finding, false);
        const onMouseLeave = () => {
          if (pinnedElement !== element) {
            hidePopover();
          }
        };
        const onFocus = () => showPopover(element, finding, false);
        const onBlur = () => {
          if (pinnedElement !== element) {
            hidePopover();
          }
        };
        const onClick = () => {
          if (pinnedElement === element) {
            hidePopover();
          } else {
            showPopover(element, finding, true);
          }
        };

        element.addEventListener("mouseenter", onMouseEnter);
        element.addEventListener("mouseleave", onMouseLeave);
        element.addEventListener("focus", onFocus);
        element.addEventListener("blur", onBlur);
        element.addEventListener("click", onClick);

        highlightRecords.push({
          element,
          description,
          attributes,
          removeListeners() {
            element.removeEventListener("mouseenter", onMouseEnter);
            element.removeEventListener("mouseleave", onMouseLeave);
            element.removeEventListener("focus", onFocus);
            element.removeEventListener("blur", onBlur);
            element.removeEventListener("click", onClick);
          },
        });
      }

      if (highlightRecords.length === 0) {
        status.textContent = "No se encontraron los párrafos señalados.";
        status.hidden = false;
      }
    },

    destroy() {
      if (destroyed) {
        return;
      }

      destroyed = true;
      clearHighlights();
      document.removeEventListener("click", onDocumentClick);
      document.removeEventListener("keydown", onDocumentKeydown);
      host.remove();
    },
  };
}
