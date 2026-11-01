// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import type { AnalyzeArticleResult } from "../messages.js";
import {
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  type ConsentStorage,
} from "../consent/consent-state.js";
import { runPageAnalysis, type RunPageAnalysisDependencies } from "./run-page-analysis.js";

function createStorage(value?: unknown, events: string[] = []) {
  const values: Record<string, unknown> = {
    ...(value === undefined ? {} : { [CONSENT_STORAGE_KEY]: value }),
  };
  const storage: ConsentStorage = {
    async get(key) {
      return { [key]: values[key] };
    },
    async set(items) {
      events.push("save");
      Object.assign(values, items);
    },
  };
  return { storage, values };
}

function dependencies(overrides: Partial<RunPageAnalysisDependencies> = {}) {
  const events: string[] = [];
  const { storage } = createStorage(
    { version: CONSENT_VERSION, acceptedAt: "2026-11-01T12:00:00.000Z" },
    events,
  );
  let uiCount = 0;
  const errors: string[] = [];
  const deps: RunPageAnalysisDependencies = {
    page: {},
    document,
    consentStorage: storage,
    publicSiteUrl: "https://critical-reader.example",
    requestConsent: async () => "accepted",
    extractArticle: () => {
      events.push("extract");
      const element = document.querySelector<HTMLParagraphElement>("p")!;
      return {
        request: {
          title: "Artículo",
          subtitle: "",
          language: "es",
          paragraphs: [{ id: "p0", text: element.textContent ?? "" }],
        },
        elementsByParagraphId: new Map([["p0", element]]),
      };
    },
    createReaderUi: () => {
      uiCount += 1;
      return {
        showLoading() {},
        showError(message) {
          errors.push(message);
        },
        renderFindings() {},
        destroy() {},
      };
    },
    sendAnalysis: async (): Promise<AnalyzeArticleResult> => {
      events.push("send");
      return { ok: true, data: { findings: [] } };
    },
    ...overrides,
  };
  return { deps, events, errors, uiCount: () => uiCount };
}

beforeEach(() => {
  document.body.innerHTML = "<article><h1>Artículo</h1><p>Contenido.</p></article>";
});

describe("runPageAnalysis", () => {
  it("does not extract or send article content when consent is cancelled", async () => {
    const events: string[] = [];
    const { storage } = createStorage(undefined, events);
    const setup = dependencies({
      consentStorage: storage,
      requestConsent: async () => "cancelled",
    });

    await runPageAnalysis(setup.deps);

    expect(setup.events).toEqual([]);
    expect(setup.uiCount()).toBe(0);
  });

  it("persists accepted consent before extracting and sending once", async () => {
    const events: string[] = [];
    const { storage, values } = createStorage(undefined, events);
    const setup = dependencies({ consentStorage: storage });
    setup.deps.extractArticle = () => {
      events.push("extract");
      return dependencies().deps.extractArticle(document);
    };
    setup.deps.sendAnalysis = async () => {
      events.push("send");
      return { ok: true, data: { findings: [] } };
    };

    await runPageAnalysis(setup.deps);

    expect(events).toEqual(["save", "extract", "send"]);
    expect(values[CONSENT_STORAGE_KEY]).toMatchObject({ version: CONSENT_VERSION });
  });

  it("skips the dialog for current consent but re-prompts for stale consent", async () => {
    let prompts = 0;
    const current = dependencies({
      requestConsent: async () => {
        prompts += 1;
        return "accepted";
      },
    });
    await runPageAnalysis(current.deps);
    expect(prompts).toBe(0);

    const { storage } = createStorage({
      version: "2026-10-01",
      acceptedAt: "2026-10-01T12:00:00.000Z",
    });
    const stale = dependencies({
      consentStorage: storage,
      requestConsent: async () => {
        prompts += 1;
        return "accepted";
      },
    });
    await runPageAnalysis(stale.deps);
    expect(prompts).toBe(1);
  });

  it("allows only one request and one reader UI while analysis is active", async () => {
    let resolveRequest: ((value: AnalyzeArticleResult) => void) | undefined;
    let markRequestStarted: (() => void) | undefined;
    const requestStarted = new Promise<void>((resolve) => {
      markRequestStarted = resolve;
    });
    let sends = 0;
    const setup = dependencies({
      page: {},
      sendAnalysis: () => {
        sends += 1;
        markRequestStarted?.();
        return new Promise((resolve) => {
          resolveRequest = resolve;
        });
      },
    });

    const first = runPageAnalysis(setup.deps);
    const second = runPageAnalysis(setup.deps);
    await second;
    await requestStarted;

    expect(sends).toBe(1);
    expect(setup.uiCount()).toBe(1);

    resolveRequest?.({ ok: true, data: { findings: [] } });
    await first;
  });

  it("uses an online-service error without referring to a local server", async () => {
    const setup = dependencies({
      sendAnalysis: async () => ({ ok: false, error: "analysis_failed" }),
    });

    await runPageAnalysis(setup.deps);

    expect(setup.errors).toEqual([
      "No se pudo conectar con el servicio. Inténtalo de nuevo más tarde.",
    ]);
  });
});
