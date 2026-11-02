import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("API runtime contracts", () => {
  it("stay byte-for-byte synchronized with the canonical workspace contracts", async () => {
    const [localContracts, canonicalContracts] = await Promise.all([
      readFile(new URL("./contracts.ts", import.meta.url), "utf8"),
      readFile(
        new URL("../../../packages/contracts/src/index.ts", import.meta.url),
        "utf8",
      ),
    ]);

    expect(localContracts).toBe(canonicalContracts);
  });
});
