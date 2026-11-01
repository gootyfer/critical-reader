import { describe, expect, it } from "vitest";

import { createExtensionConfig } from "./extension-config.js";
import { createManifestConfig } from "./manifest-config.js";

describe("createManifestConfig", () => {
  it("grants only the permissions and exact API origin used by the beta", () => {
    const extensionConfig = createExtensionConfig({
      apiBaseUrl: "https://critical-reader-api.vercel.app",
      clientVersion: "0.2.0",
      production: true,
    });

    expect(createManifestConfig(extensionConfig)).toMatchObject({
      name: "Critical Reader BETA",
      description: "THIS EXTENSION IS FOR BETA TESTING. Destaca expresiones discriminatorias claramente detectadas.",
      version: "0.2.0",
      permissions: ["activeTab", "scripting", "storage"],
      host_permissions: ["https://critical-reader-api.vercel.app/*"],
      action: { default_title: "Analizar esta página" },
    });
  });

  it("never emits wildcard or OpenAI host permissions", () => {
    const manifest = createManifestConfig(
      createExtensionConfig({
        apiBaseUrl: "https://critical-reader-api.vercel.app",
        clientVersion: "0.2.0",
        production: true,
      }),
    );

    expect(manifest.host_permissions).not.toContain("<all_urls>");
    expect(manifest.host_permissions.join(" ")).not.toContain("api.openai.com");
    expect(manifest.host_permissions).toEqual([
      "https://critical-reader-api.vercel.app/*",
    ]);
  });
});
