import { browser } from "wxt/browser";

import { extractArticle } from "../src/article/extract-article.js";
import type {
  AnalyzeArticleMessage,
  AnalyzeArticleResult,
} from "../src/messages.js";
import { createReaderUi, type ReaderUi } from "../src/ui/reader-ui.js";

const UI_STATE_KEY = Symbol.for("critical-reader.reader-ui");

export default defineContentScript({
  registration: "runtime",
  async main() {
    const pageState = globalThis as typeof globalThis &
      Record<symbol, ReaderUi | undefined>;

    pageState[UI_STATE_KEY]?.destroy();

    const ui = createReaderUi(document);
    pageState[UI_STATE_KEY] = ui;
    const extracted = extractArticle(document);

    if (!extracted) {
      ui.showError("No se encontró un artículo con párrafos analizables.");
      return;
    }

    ui.showLoading();

    const message: AnalyzeArticleMessage = {
      type: "ANALYZE_ARTICLE",
      payload: extracted.request,
    };

    try {
      const result = (await browser.runtime.sendMessage(
        message,
      )) as AnalyzeArticleResult | undefined;

      if (pageState[UI_STATE_KEY] !== ui) {
        return;
      }

      if (!result?.ok) {
        ui.showError(
          "No se pudo analizar. Comprueba que el servidor local esté funcionando.",
        );
        return;
      }

      ui.renderFindings(extracted, result.data);
    } catch {
      if (pageState[UI_STATE_KEY] !== ui) {
        return;
      }

      ui.showError(
        "No se pudo analizar. Comprueba que el servidor local esté funcionando.",
      );
    }
  },
});
