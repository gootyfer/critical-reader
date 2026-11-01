export const CONSENT_VERSION = "2026-11-01";
export const CONSENT_STORAGE_KEY = "criticalReaderConsent";

export interface ConsentStorage {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export async function hasAcceptedConsent(
  storage: ConsentStorage,
): Promise<boolean> {
  const stored = (await storage.get(CONSENT_STORAGE_KEY))[CONSENT_STORAGE_KEY];
  if (typeof stored !== "object" || stored === null) return false;

  const candidate = stored as { version?: unknown; acceptedAt?: unknown };
  return (
    candidate.version === CONSENT_VERSION &&
    typeof candidate.acceptedAt === "string" &&
    Number.isFinite(Date.parse(candidate.acceptedAt))
  );
}

export async function saveConsent(
  storage: ConsentStorage,
  now: () => Date = () => new Date(),
): Promise<void> {
  await storage.set({
    [CONSENT_STORAGE_KEY]: {
      version: CONSENT_VERSION,
      acceptedAt: now().toISOString(),
    },
  });
}
