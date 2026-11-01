import { describe, expect, it } from "vitest";

import { ConfigurationError } from "./config.js";
import { loadServerPolicy } from "./server-policy.js";

describe("loadServerPolicy", () => {
  it("uses permissive local defaults with a bounded request body", () => {
    expect(loadServerPolicy({})).toEqual({
      production: false,
      analysisEnabled: true,
      allowedExtensionOrigins: [],
      requiredClientVersion: null,
      fixturesEnabled: true,
      bodyLimitBytes: 128 * 1024,
    });
  });

  it("loads an exact production client policy", () => {
    expect(
      loadServerPolicy({
        NODE_ENV: "production",
        ANALYSIS_ENABLED: "false",
        ALLOWED_EXTENSION_ORIGINS:
          "chrome-extension://abcdefghijklmnop, chrome-extension://pending",
        CRITICAL_READER_CLIENT_VERSION: "0.2.0",
      }),
    ).toEqual({
      production: true,
      analysisEnabled: false,
      allowedExtensionOrigins: [
        "chrome-extension://abcdefghijklmnop",
        "chrome-extension://pending",
      ],
      requiredClientVersion: "0.2.0",
      fixturesEnabled: false,
      bodyLimitBytes: 128 * 1024,
    });
  });

  it.each([
    [{ NODE_ENV: "production", CRITICAL_READER_CLIENT_VERSION: "0.2.0" }],
    [{ NODE_ENV: "production", ALLOWED_EXTENSION_ORIGINS: "chrome-extension://valid" }],
    [{
      NODE_ENV: "production",
      ALLOWED_EXTENSION_ORIGINS: "*",
      CRITICAL_READER_CLIENT_VERSION: "0.2.0",
    }],
    [{
      NODE_ENV: "production",
      ALLOWED_EXTENSION_ORIGINS: "https://example.com",
      CRITICAL_READER_CLIENT_VERSION: "0.2.0",
    }],
    [{
      NODE_ENV: "production",
      ALLOWED_EXTENSION_ORIGINS: "chrome-extension://valid/path",
      CRITICAL_READER_CLIENT_VERSION: "0.2.0",
    }],
    [{
      NODE_ENV: "production",
      ANALYSIS_ENABLED: "sometimes",
      ALLOWED_EXTENSION_ORIGINS: "chrome-extension://valid",
      CRITICAL_READER_CLIENT_VERSION: "0.2.0",
    }],
  ])("rejects unsafe production policy %#", (env) => {
    expect(() => loadServerPolicy(env)).toThrow(ConfigurationError);
  });
});
