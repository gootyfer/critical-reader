import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "Critical Reader",
    description: "Destaca expresiones discriminatorias claramente detectadas.",
    version: "0.1.0",
    permissions: ["activeTab", "scripting"],
    host_permissions: ["http://127.0.0.1:8787/*"],
    action: {
      default_title: "Analizar esta página",
    },
  },
});
