import { browser } from "wxt/browser";

import { runPageAnalysis } from "../src/analysis/run-page-analysis.js";
import { extractArticle } from "../src/article/extract-article.js";
import { createExtensionConfig } from "../src/config/extension-config.js";
import type {
  AnalyzeArticleMessage,
  AnalyzeArticleResult,
} from "../src/messages.js";
import { requestAnalysisConsent } from "../src/ui/consent-ui.js";
import { createReaderUi } from "../src/ui/reader-ui.js";

const extensionConfig = createExtensionConfig({
  apiBaseUrl:
    import.meta.env.WXT_API_BASE_URL ?? "http://127.0.0.1:8787",
  clientVersion: browser.runtime.getManifest().version,
  production: import.meta.env.MODE === "production",
});

export default defineContentScript({
  registration: "runtime",
  async main() {
    await runPageAnalysis({
      page: globalThis,
      document,
      consentStorage: {
        get: (key) => browser.storage.local.get(key),
        set: (items) => browser.storage.local.set(items),
      },
      publicSiteUrl: extensionConfig.publicSiteUrl,
      requestConsent: requestAnalysisConsent,
      extractArticle,
      createReaderUi,
      sendAnalysis: async (payload) => {
        const message: AnalyzeArticleMessage = {
          type: "ANALYZE_ARTICLE",
          payload,
        };
        return (await browser.runtime.sendMessage(message)) as
          | AnalyzeArticleResult
          | undefined;
      },
    });
  },
});
