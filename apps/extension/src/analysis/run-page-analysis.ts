import type { ExtractedArticle } from "../article/extract-article.js";
import {
  hasAcceptedConsent,
  saveConsent,
  type ConsentStorage,
} from "../consent/consent-state.js";
import type { AnalyzeArticleResult } from "../messages.js";
import type { ReaderUi } from "../ui/reader-ui.js";
import {
  finishPageAnalysis,
  getPageReaderUi,
  setPageReaderUi,
  tryStartPageAnalysis,
} from "./page-analysis-state.js";

const SERVICE_ERROR =
  "No se pudo conectar con el servicio. Inténtalo de nuevo más tarde.";

export interface RunPageAnalysisDependencies {
  page: object;
  document: Document;
  consentStorage: ConsentStorage;
  publicSiteUrl: string;
  requestConsent(
    document: Document,
    links: { privacyUrl: string; termsUrl: string },
  ): Promise<"accepted" | "cancelled">;
  extractArticle(document: Document): ExtractedArticle | null;
  createReaderUi(document: Document): ReaderUi;
  sendAnalysis(
    request: ExtractedArticle["request"],
  ): Promise<AnalyzeArticleResult | undefined>;
}

export async function runPageAnalysis(
  dependencies: RunPageAnalysisDependencies,
): Promise<void> {
  if (!tryStartPageAnalysis(dependencies.page)) return;

  try {
    if (!(await hasAcceptedConsent(dependencies.consentStorage))) {
      const consent = await dependencies.requestConsent(dependencies.document, {
        privacyUrl: `${dependencies.publicSiteUrl}/privacy`,
        termsUrl: `${dependencies.publicSiteUrl}/terms`,
      });
      if (consent !== "accepted") return;
      await saveConsent(dependencies.consentStorage);
    }

    getPageReaderUi(dependencies.page)?.destroy();
    const ui = dependencies.createReaderUi(dependencies.document);
    setPageReaderUi(dependencies.page, ui);
    const extracted = dependencies.extractArticle(dependencies.document);

    if (!extracted) {
      ui.showError("No se encontró un artículo con párrafos analizables.");
      return;
    }

    ui.showLoading();

    try {
      const result = await dependencies.sendAnalysis(extracted.request);
      if (getPageReaderUi(dependencies.page) !== ui) return;

      if (!result?.ok) {
        ui.showError(SERVICE_ERROR);
        return;
      }

      ui.renderFindings(extracted, result.data);
    } catch {
      if (getPageReaderUi(dependencies.page) === ui) {
        ui.showError(SERVICE_ERROR);
      }
    }
  } finally {
    finishPageAnalysis(dependencies.page);
  }
}
