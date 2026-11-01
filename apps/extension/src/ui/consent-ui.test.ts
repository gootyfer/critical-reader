// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import { requestAnalysisConsent } from "./consent-ui.js";

const links = {
  privacyUrl: "https://critical-reader.example/privacy",
  termsUrl: "https://critical-reader.example/terms",
};

function dialogRoot() {
  const host = document.querySelector<HTMLElement>(
    "[data-critical-reader-consent-host]",
  );
  if (!host?.shadowRoot) throw new Error("Consent dialog is missing");
  return host.shadowRoot;
}

beforeEach(() => {
  document.body.innerHTML = "<article><p>Texto original</p></article>";
});

describe("requestAnalysisConsent", () => {
  it("shows a prominent accessible disclosure with policy links", () => {
    void requestAnalysisConsent(document, links);
    const root = dialogRoot();
    const text = root.textContent ?? "";

    expect(root.querySelector("[role='dialog'][aria-modal='true']")).not.toBeNull();
    expect(text).toContain("título, subtítulo y párrafos visibles");
    expect(text).toContain("Vercel");
    expect(text).toContain("OpenAI");
    expect(text).toContain("no dispone de Zero Data Retention (ZDR)");
    expect(text).toContain("hasta 30 días");
    expect(root.querySelector("a[href='https://critical-reader.example/privacy']")).not.toBeNull();
    expect(root.querySelector("a[href='https://critical-reader.example/terms']")).not.toBeNull();
    expect(document.querySelector("article")?.textContent).toBe("Texto original");
  });

  it("resolves accepted only after the explicit accept action", async () => {
    const result = requestAnalysisConsent(document, links);

    dialogRoot()
      .querySelector<HTMLButtonElement>("[data-action='accept']")
      ?.click();

    await expect(result).resolves.toBe("accepted");
    expect(document.querySelector("[data-critical-reader-consent-host]")).toBeNull();
  });

  it.each(["cancel", "escape"])("cancels via %s without leaving UI behind", async (action) => {
    const result = requestAnalysisConsent(document, links);

    if (action === "cancel") {
      dialogRoot()
        .querySelector<HTMLButtonElement>("[data-action='cancel']")
        ?.click();
    } else {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    }

    await expect(result).resolves.toBe("cancelled");
    expect(document.querySelector("[data-critical-reader-consent-host]")).toBeNull();
  });
});
