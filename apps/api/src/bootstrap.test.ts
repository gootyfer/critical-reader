import { describe, expect, it, vi } from "vitest";

import { ConfigurationError } from "./config.js";
import { API_ENV_PATH, createConfiguredServer, loadLocalEnv } from "./bootstrap.js";

describe("API bootstrap", () => {
  it("resolves the env file from the API package instead of the current directory", () => {
    expect(API_ENV_PATH).toMatch(/\/apps\/api\/\.env$/u);
  });

  it("loads the local env file only when it exists", () => {
    const loadEnvFile = vi.fn();

    loadLocalEnv("/api/.env", { existsSync: () => false, loadEnvFile });
    expect(loadEnvFile).not.toHaveBeenCalled();

    loadLocalEnv("/api/.env", { existsSync: () => true, loadEnvFile });
    expect(loadEnvFile).toHaveBeenCalledWith("/api/.env");
  });

  it("builds a server with the configured analyzer name", async () => {
    const app = await createConfiguredServer({ ANALYZER: "fake" });

    const response = await app.inject({ method: "GET", url: "/health" });
    await app.close();

    expect(response.json()).toEqual({ status: "ok", analyzer: "fake" });
  });

  it("rejects invalid configuration before creating a server", async () => {
    await expect(
      createConfiguredServer({ ANALYZER: "openai" }),
    ).rejects.toBeInstanceOf(ConfigurationError);
  });
});
