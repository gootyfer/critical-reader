import { browser } from "wxt/browser";

import { requestAnalysis } from "../src/analysis/request-analysis.js";
import { createExtensionConfig } from "../src/config/extension-config.js";
import {
  isAnalyzeArticleMessage,
  type AnalyzeArticleResult,
} from "../src/messages.js";

const DEFAULT_ACTION_TITLE = "Analizar esta página";
const INJECTION_ERROR_TITLE = "Critical Reader no puede analizar esta página";

const extensionConfig = createExtensionConfig({
  apiBaseUrl:
    import.meta.env.WXT_API_BASE_URL ?? "http://127.0.0.1:8787",
  clientVersion: browser.runtime.getManifest().version,
  production: import.meta.env.MODE === "production",
});

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message) => {
    if (!isAnalyzeArticleMessage(message)) {
      return undefined;
    }

    return requestAnalysis(globalThis.fetch, message.payload, {
      endpoint: extensionConfig.analyzeEndpoint,
      clientVersion: extensionConfig.clientVersion,
    })
      .then(
        (data): AnalyzeArticleResult => ({ ok: true, data }),
      )
      .catch(
        (): AnalyzeArticleResult => ({ ok: false, error: "analysis_failed" }),
      );
  });

  browser.action.onClicked.addListener(async (tab) => {
    if (tab.id === undefined) {
      return;
    }

    const tabId = tab.id;

    try {
      await browser.action.setBadgeText({ tabId, text: "" });
      await browser.action.setTitle({ tabId, title: DEFAULT_ACTION_TITLE });
      await browser.scripting.executeScript({
        target: { tabId },
        files: ["/content-scripts/analyze.js"],
      });
    } catch {
      await browser.action.setBadgeBackgroundColor({
        tabId,
        color: "#b42318",
      });
      await browser.action.setBadgeText({ tabId, text: "!" });
      await browser.action.setTitle({ tabId, title: INJECTION_ERROR_TITLE });

      setTimeout(() => {
        void browser.action.setBadgeText({ tabId, text: "" });
        void browser.action.setTitle({ tabId, title: DEFAULT_ACTION_TITLE });
      }, 4_000);
    }
  });
});
