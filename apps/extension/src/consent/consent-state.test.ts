import { describe, expect, it } from "vitest";

import {
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  hasAcceptedConsent,
  saveConsent,
  type ConsentStorage,
} from "./consent-state.js";

function memoryStorage(initial: Record<string, unknown> = {}) {
  const values = { ...initial };
  const writes: Record<string, unknown>[] = [];
  const storage: ConsentStorage = {
    async get(key) {
      return { [key]: values[key] };
    },
    async set(items) {
      Object.assign(values, items);
      writes.push(items);
    },
  };
  return { storage, values, writes };
}

describe("consent state", () => {
  it("accepts only a complete record for the current consent version", async () => {
    const current = {
      version: CONSENT_VERSION,
      acceptedAt: "2026-11-01T12:00:00.000Z",
    };

    for (const value of [
      undefined,
      false,
      { version: "2026-10-01", acceptedAt: current.acceptedAt },
      { version: CONSENT_VERSION },
      { version: CONSENT_VERSION, acceptedAt: "not-a-date" },
    ]) {
      const { storage } = memoryStorage({ [CONSENT_STORAGE_KEY]: value });
      await expect(hasAcceptedConsent(storage)).resolves.toBe(false);
    }

    const { storage } = memoryStorage({ [CONSENT_STORAGE_KEY]: current });
    await expect(hasAcceptedConsent(storage)).resolves.toBe(true);
  });

  it("stores only the version and acceptance timestamp", async () => {
    const { storage, writes } = memoryStorage();

    await saveConsent(storage, () => new Date("2026-11-01T12:00:00.000Z"));

    expect(writes).toEqual([
      {
        [CONSENT_STORAGE_KEY]: {
          version: "2026-11-01",
          acceptedAt: "2026-11-01T12:00:00.000Z",
        },
      },
    ]);
  });
});
