import { describe, expect, it } from "vitest";

import { createExtensionConfig } from "./extension-config.js";

describe("createExtensionConfig", () => {
  it("normalizes a local development API origin and derives service URLs", () => {
    expect(
      createExtensionConfig({
        apiBaseUrl: "http://127.0.0.1:8787/",
        clientVersion: "0.2.0",
        production: false,
      }),
    ).toEqual({
      apiBaseUrl: "http://127.0.0.1:8787",
      analyzeEndpoint: "http://127.0.0.1:8787/analyze",
      publicSiteUrl: "http://127.0.0.1:8787",
      clientVersion: "0.2.0",
    });
  });

  it("accepts an HTTPS production origin", () => {
    expect(
      createExtensionConfig({
        apiBaseUrl: "https://critical-reader-api.vercel.app",
        clientVersion: "0.2.0",
        production: true,
      }).analyzeEndpoint,
    ).toBe("https://critical-reader-api.vercel.app/analyze");
  });

  it.each([
    ["", false],
    ["http://localhost:8787", false],
    ["http://example.com", false],
    ["http://127.0.0.1:8787/path", false],
    ["https://user:secret@example.com", false],
    ["http://127.0.0.1:8787", true],
    ["https://example.com/path", true],
    ["https://*.example.com", true],
  ])("rejects unsafe API base URL %s in production=%s", (apiBaseUrl, production) => {
    expect(() =>
      createExtensionConfig({ apiBaseUrl, clientVersion: "0.2.0", production }),
    ).toThrow("Invalid extension configuration");
  });

  it("rejects an empty client version", () => {
    expect(() =>
      createExtensionConfig({
        apiBaseUrl: "https://example.com",
        clientVersion: " ",
        production: true,
      }),
    ).toThrow("Invalid extension configuration");
  });
});
