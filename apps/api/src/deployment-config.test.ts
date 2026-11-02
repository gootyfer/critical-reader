import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

type VercelConfig = {
  regions?: string[];
  functions?: Record<string, { maxDuration?: number }>;
};

describe("Vercel deployment configuration", () => {
  it("pins the auto-detected Fastify API to Frankfurt", async () => {
    const contents = await readFile(new URL("../vercel.json", import.meta.url), "utf8");
    const config = JSON.parse(contents) as VercelConfig;

    expect(config.regions).toEqual(["fra1"]);
    expect(config.functions).toBeUndefined();
  });

  it("does not embed credentials or secret values", async () => {
    const contents = await readFile(new URL("../vercel.json", import.meta.url), "utf8");

    expect(contents).not.toMatch(/sk-[A-Za-z0-9_-]+/);
    expect(contents).not.toMatch(/OPENAI_API_KEY|authorization|bearer|token/i);
  });

  it("keeps the serverless runtime independent from workspace symlinks", async () => {
    const manifest = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    ) as {
      dependencies?: Record<string, string>;
      dependenciesMeta?: Record<string, { injected?: boolean }>;
    };

    expect(manifest.dependencies).not.toHaveProperty(
      "@critical-reader/contracts",
    );
    expect(manifest.dependenciesMeta).toBeUndefined();
  });

  it("exposes one explicit Vercel Fastify entrypoint", async () => {
    expect(existsSync(new URL("./server.ts", import.meta.url))).toBe(false);
    expect(existsSync(new URL("./app-server.ts", import.meta.url))).toBe(true);
    expect(existsSync(new URL("./app.ts", import.meta.url))).toBe(true);

    const entrypoint = await readFile(
      new URL("./app.ts", import.meta.url),
      "utf8",
    );
    expect(entrypoint).toMatch(/from "fastify"/u);
    expect(entrypoint).toMatch(/export default app/u);
  });
});
