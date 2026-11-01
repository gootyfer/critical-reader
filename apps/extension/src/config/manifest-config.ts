import type { ExtensionConfig } from "./extension-config.js";

export function createManifestConfig(_config: ExtensionConfig) {
  const origin = new URL(_config.apiBaseUrl).origin;
  if (origin.includes("*")) {
    throw new Error("Invalid extension configuration");
  }

  const icons = {
    16: "icon/16.png",
    32: "icon/32.png",
    48: "icon/48.png",
    128: "icon/128.png",
  };

  return {
    name: "Critical Reader BETA",
    description:
      "THIS EXTENSION IS FOR BETA TESTING. Destaca expresiones discriminatorias claramente detectadas.",
    version: "0.2.0",
    permissions: ["activeTab", "scripting", "storage"],
    host_permissions: [`${origin}/*`],
    icons,
    action: {
      default_title: "Analizar esta página",
      default_icon: icons,
    },
  };
}
