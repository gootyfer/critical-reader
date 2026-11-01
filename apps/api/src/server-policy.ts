import { ConfigurationError } from "./config.js";

export interface ServerPolicy {
  production: boolean;
  analysisEnabled: boolean;
  allowedExtensionOrigins: readonly string[];
  requiredClientVersion: string | null;
  fixturesEnabled: boolean;
  bodyLimitBytes: number;
}

const BODY_LIMIT_BYTES = 128 * 1024;
const EXTENSION_ORIGIN_PATTERN = /^chrome-extension:\/\/[a-z0-9_-]+$/u;

const parseAnalysisEnabled = (value: string | undefined): boolean => {
  if (value === undefined || value === "true") return true;
  if (value === "false") return false;
  throw new ConfigurationError();
};

const parseExtensionOrigins = (value: string | undefined): string[] => {
  const origins = (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (
    origins.length === 0 ||
    origins.some((origin) => !EXTENSION_ORIGIN_PATTERN.test(origin))
  ) {
    throw new ConfigurationError();
  }

  return [...new Set(origins)];
};

export const loadServerPolicy = (env: NodeJS.ProcessEnv): ServerPolicy => {
  const production = env.NODE_ENV === "production";
  if (!production) {
    return {
      production: false,
      analysisEnabled: true,
      allowedExtensionOrigins: [],
      requiredClientVersion: null,
      fixturesEnabled: true,
      bodyLimitBytes: BODY_LIMIT_BYTES,
    };
  }

  const requiredClientVersion = env.CRITICAL_READER_CLIENT_VERSION?.trim();
  if (!requiredClientVersion) throw new ConfigurationError();

  return {
    production: true,
    analysisEnabled: parseAnalysisEnabled(env.ANALYSIS_ENABLED),
    allowedExtensionOrigins: parseExtensionOrigins(
      env.ALLOWED_EXTENSION_ORIGINS,
    ),
    requiredClientVersion,
    fixturesEnabled: false,
    bodyLimitBytes: BODY_LIMIT_BYTES,
  };
};
