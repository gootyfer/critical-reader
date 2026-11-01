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
      icons: {
        16: "icon/16.png",
        32: "icon/32.png",
        48: "icon/48.png",
        128: "icon/128.png",
      },
      action: {
        default_title: "Analizar esta página",
        default_icon: {
          16: "icon/16.png",
          32: "icon/32.png",
          48: "icon/48.png",
          128: "icon/128.png",
        },
      },
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
    expect(manifest.permissions).toEqual(["activeTab", "scripting", "storage"]);
    expect(JSON.stringify(manifest)).not.toContain("<all_urls>");
    expect(JSON.stringify(manifest)).not.toContain("api.openai.com");
    expect(manifest).not.toHaveProperty("content_security_policy");
    expect(manifest).not.toHaveProperty("externally_connectable");
  });
});
