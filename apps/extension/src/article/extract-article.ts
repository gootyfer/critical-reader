import {
  AnalyzeRequestSchema,
  MAX_PARAGRAPHS,
  MAX_TOTAL_CHARACTERS,
  type AnalyzeRequest,
} from "@critical-reader/contracts";

const MAX_TITLE_CHARACTERS = 2_000;
const MAX_SUBTITLE_CHARACTERS = 4_000;
const MAX_PARAGRAPH_CHARACTERS = 20_000;

export interface ExtractedArticle {
  request: AnalyzeRequest;
  elementsByParagraphId: Map<string, HTMLParagraphElement>;
}

function normalizeText(text: string): string {
  return text.normalize("NFC").replace(/\s+/gu, " ").trim();
}

function visibleText(element: Element | null): string {
  if (!element || !isVisible(element)) {
    return "";
  }

  const textParts: string[] = [];

  const visit = (node: Node) => {
    if (node.nodeType === node.TEXT_NODE) {
      textParts.push(node.textContent ?? "");
      return;
    }

    if (!(node instanceof Element) || !isVisible(node)) {
      return;
    }

    if (["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(node.tagName)) {
      return;
    }

    node.childNodes.forEach(visit);
  };

  element.childNodes.forEach(visit);
  return normalizeText(textParts.join(" "));
}

function isVisible(element: Element): boolean {
  let current: Element | null = element;

  while (current) {
    if (current.hasAttribute("hidden") || current.getAttribute("aria-hidden") === "true") {
      return false;
    }

    const style = current.ownerDocument.defaultView?.getComputedStyle(current);
    if (
      style?.display === "none" ||
      style?.visibility === "hidden" ||
      style?.visibility === "collapse" ||
      style?.contentVisibility === "hidden"
    ) {
      return false;
    }

    current = current.parentElement;
  }

  return true;
}

function findSubtitle(root: Element): string {
  const selectors = [
    ".subtitle",
    "[class*='subtitle' i]",
    "[class*='subheadline' i]",
    "[data-testid*='subtitle' i]",
    "header h2",
  ];

  for (const selector of selectors) {
    for (const element of root.querySelectorAll(selector)) {
      const text = visibleText(element);
      if (text) {
        return text.slice(0, MAX_SUBTITLE_CHARACTERS);
      }
    }
  }

  return "";
}

export function extractArticle(document: Document): ExtractedArticle | null {
  const root =
    document.querySelector("article") ??
    document.querySelector("main") ??
    document.body;

  if (!root) {
    return null;
  }

  const title = (
    visibleText(root.querySelector("h1")) || normalizeText(document.title)
  ).slice(0, MAX_TITLE_CHARACTERS);
  const subtitle = findSubtitle(root);
  const paragraphs: AnalyzeRequest["paragraphs"] = [];
  const elementsByParagraphId = new Map<string, HTMLParagraphElement>();
  let totalCharacters = title.length + subtitle.length;

  for (const element of root.querySelectorAll<HTMLParagraphElement>("p")) {
    if (paragraphs.length >= MAX_PARAGRAPHS) {
      break;
    }

    const text = visibleText(element);
    if (!text || text.length > MAX_PARAGRAPH_CHARACTERS) {
      continue;
    }

    if (totalCharacters + text.length > MAX_TOTAL_CHARACTERS) {
      break;
    }

    const id = `p${paragraphs.length}`;
    paragraphs.push({ id, text });
    elementsByParagraphId.set(id, element);
    totalCharacters += text.length;
  }

  if (paragraphs.length === 0) {
    return null;
  }

  const request = AnalyzeRequestSchema.parse({
    title,
    subtitle,
    language: "es",
    paragraphs,
  });

  return { request, elementsByParagraphId };
}
