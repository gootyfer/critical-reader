import { createHash } from "node:crypto";

import type { AnalyzeRequest } from "@critical-reader/contracts";

export function normalizeText(text: string): string {
  return text.normalize("NFC").replace(/\s+/gu, " ").trim();
}

export function createContentHash(input: AnalyzeRequest): string {
  const normalizedContent = JSON.stringify({
    title: normalizeText(input.title),
    subtitle: normalizeText(input.subtitle),
    paragraphs: input.paragraphs.map(({ text }) => normalizeText(text)),
  });

  return createHash("sha256").update(normalizedContent).digest("hex");
}
