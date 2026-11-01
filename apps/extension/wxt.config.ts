import { defineConfig } from "wxt";

import { createExtensionConfig } from "./src/config/extension-config.js";
import { createManifestConfig } from "./src/config/manifest-config.js";

export default defineConfig({
  manifest: ({ mode }) => {
    const production = mode === "production";
    const apiBaseUrl =
      process.env.WXT_API_BASE_URL ??
      (production ? "" : "http://127.0.0.1:8787");

    return createManifestConfig(
      createExtensionConfig({
        apiBaseUrl,
        clientVersion: "0.2.0",
        production,
      }),
    );
  },
});
