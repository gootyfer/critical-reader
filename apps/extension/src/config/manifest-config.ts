import type { ExtensionConfig } from "./extension-config.js";

export function createManifestConfig(_config: ExtensionConfig) {
  const origin = new URL(_config.apiBaseUrl).origin;
  if (origin.includes("*")) {
    throw new Error("Invalid extension configuration");
  }

  return {
    name: "Critical Reader BETA",
    description:
      "THIS EXTENSION IS FOR BETA TESTING. Destaca expresiones discriminatorias claramente detectadas.",
    version: "0.2.0",
    permissions: ["activeTab", "scripting", "storage"],
    host_permissions: [`${origin}/*`],
    action: {
      default_title: "Analizar esta página",
    },
  };
}
