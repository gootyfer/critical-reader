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

  it("packages the workspace contracts inside the serverless function", async () => {
    const manifest = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    ) as {
      dependenciesMeta?: Record<string, { injected?: boolean }>;
    };
    const workspaceConfig = await readFile(
      new URL("../../../pnpm-workspace.yaml", import.meta.url),
      "utf8",
    );
    const lockfile = await readFile(
      new URL("../../../pnpm-lock.yaml", import.meta.url),
      "utf8",
    );

    expect(
      manifest.dependenciesMeta?.["@critical-reader/contracts"]?.injected,
    ).toBe(true);
    expect(workspaceConfig).toMatch(/dedupeInjectedDeps:\s*false/u);
    expect(lockfile).toMatch(
      /apps\/api:[\s\S]*?dependenciesMeta:\s*\n\s+'@critical-reader\/contracts':\s*\n\s+injected: true/u,
    );
  });
});
