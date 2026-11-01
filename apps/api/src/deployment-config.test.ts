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
});
