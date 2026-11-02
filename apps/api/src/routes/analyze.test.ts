import { Writable } from "node:stream";

import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  AnalyzeRequest,
  AnalyzeResponse,
} from "../contracts.js";

import type { ArticleAnalyzer } from "../analyzers/article-analyzer.js";
import {
  ArticleAnalyzerError,
  type ArticleAnalyzerErrorCode,
} from "../analyzers/analyzer-error.js";
import { createContentHash } from "../cache/content-hash.js";
import { buildServer } from "../app-server.js";
import type { ServerPolicy } from "../server-policy.js";

const servers: Awaited<ReturnType<typeof buildServer>>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

const validRequest: AnalyzeRequest = {
  title: "Artículo",
  subtitle: "Contexto",
  language: "es",
  paragraphs: [{ id: "p0", text: "Un párrafo válido." }],
};

async function serverWith(
  analyzer: ArticleAnalyzer,
  options: Parameters<typeof buildServer>[0] = {},
) {
  const app = await buildServer({ ...options, analyzer });
  servers.push(app);
  return app;
}

const productionPolicy: ServerPolicy = {
  production: true,
  analysisEnabled: true,
  allowedExtensionOrigins: ["chrome-extension://valid"],
  requiredClientVersion: "0.2.0",
  fixturesEnabled: false,
  bodyLimitBytes: 128 * 1024,
};

describe("POST /analyze", () => {
  it("passes validated input to the analyzer and returns its result", async () => {
    const analyze = vi.fn(
      async (_input: AnalyzeRequest): Promise<AnalyzeResponse> => ({ findings: [] }),
    );
    const app = await serverWith({ analyze });
    const submittedRequest = {
      ...validRequest,
      ignored: "top-level value",
      paragraphs: [
        {
          ...validRequest.paragraphs[0],
          ignored: "paragraph value",
          text: "  Un párrafo válido.  ",
        },
      ],
    };

    const response = await app.inject({
      method: "POST",
      url: "/analyze",
      payload: submittedRequest,
    });

    expect(response.statusCode).toBe(200);
    expect(analyze).toHaveBeenCalledOnce();
    expect(analyze).toHaveBeenCalledWith(validRequest);
    expect(response.json()).toEqual({ findings: [] });
    expect(response.headers["x-content-hash"]).toBe(
      createContentHash(validRequest),
    );
  });

  it("does not call the analyzer when the request is invalid", async () => {
    const analyze = vi.fn(
      async (_input: AnalyzeRequest): Promise<AnalyzeResponse> => ({ findings: [] }),
    );
    const app = await serverWith({ analyze });

    const response = await app.inject({
      method: "POST",
      url: "/analyze",
      payload: { ...validRequest, language: "en" },
    });

    expect(response.statusCode).toBe(400);
    expect(analyze).not.toHaveBeenCalled();
    expect(response.json()).toMatchObject({ error: "invalid_request" });
  });

  it.each([
    [undefined, "0.2.0"],
    ["chrome-extension://other", "0.2.0"],
  ])("rejects a missing or disallowed origin before analysis", async (origin, version) => {
    const analyze = vi.fn(async (): Promise<AnalyzeResponse> => ({ findings: [] }));
    const app = await serverWith({ analyze }, { policy: productionPolicy });

    const response = await app.inject({
      method: "POST",
      url: "/analyze",
      headers: {
        ...(origin === undefined ? {} : { origin }),
        "x-critical-reader-version": version,
      },
      payload: validRequest,
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "client_not_allowed" });
    expect(analyze).not.toHaveBeenCalled();
  });

  it.each([undefined, "0.1.0"])(
    "rejects missing or unsupported client version %s before analysis",
    async (version) => {
      const analyze = vi.fn(async (): Promise<AnalyzeResponse> => ({ findings: [] }));
      const app = await serverWith({ analyze }, { policy: productionPolicy });

      const response = await app.inject({
        method: "POST",
        url: "/analyze",
        headers: {
          origin: "chrome-extension://valid",
          ...(version === undefined
            ? {}
            : { "x-critical-reader-version": version }),
        },
        payload: validRequest,
      });

      expect(response.statusCode).toBe(426);
      expect(response.json()).toEqual({ error: "unsupported_client_version" });
      expect(analyze).not.toHaveBeenCalled();
    },
  );

  it("honors the analysis kill switch before calling the analyzer", async () => {
    const analyze = vi.fn(async (): Promise<AnalyzeResponse> => ({ findings: [] }));
    const app = await serverWith(
      { analyze },
      { policy: { ...productionPolicy, analysisEnabled: false } },
    );

    const response = await app.inject({
      method: "POST",
      url: "/analyze",
      headers: {
        origin: "chrome-extension://valid",
        "x-critical-reader-version": "0.2.0",
      },
      payload: validRequest,
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: "analysis_disabled" });
    expect(analyze).not.toHaveBeenCalled();
  });

  it("rejects an oversized body before calling the analyzer", async () => {
    const analyze = vi.fn(async (): Promise<AnalyzeResponse> => ({ findings: [] }));
    const app = await serverWith({ analyze });

    const response = await app.inject({
      method: "POST",
      url: "/analyze",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({
        ...validRequest,
        paragraphs: [{ id: "p0", text: "x".repeat(140 * 1024) }],
      }),
    });

    expect(response.statusCode).toBe(413);
    expect(analyze).not.toHaveBeenCalled();
  });

  it("rejects findings that refer to an unknown paragraph", async () => {
    const app = await serverWith({
      async analyze(): Promise<AnalyzeResponse> {
        return {
          findings: [
            {
              paragraphId: "unknown",
              category: "sexism",
              mechanism: "stereotype",
              explanation: "Explicación válida.",
            },
          ],
        };
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/analyze",
      payload: validRequest,
    });

    expect(response.statusCode).toBe(502);
    expect(response.json()).toEqual({ error: "invalid_analyzer_response" });
    expect(response.headers["x-content-hash"]).toBeUndefined();
  });

  it("rejects a structurally invalid analyzer response", async () => {
    const app = await serverWith({
      async analyze(): Promise<AnalyzeResponse> {
        return {
          findings: [
            {
              paragraphId: "p0",
              category: "unsupported_category",
              mechanism: "stereotype",
              explanation: "Explicación válida.",
            },
          ],
        } as unknown as AnalyzeResponse;
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/analyze",
      payload: validRequest,
    });

    expect(response.statusCode).toBe(500);
    expect(response.headers["x-content-hash"]).toBeUndefined();
    expect(response.json()).toMatchObject({
      error: "Internal Server Error",
      statusCode: 500,
    });
  });

  it.each([
    ["timeout", 504, "analysis_timeout"],
    ["provider_error", 502, "analysis_provider_error"],
    ["refused", 502, "analysis_provider_error"],
    ["incomplete", 502, "analysis_provider_error"],
    ["invalid_response", 502, "analysis_provider_error"],
  ] as const)(
    "maps %s failures to a stable response",
    async (code, statusCode, responseError) => {
      const app = await serverWith({
        async analyze() {
          const error = new ArticleAnalyzerError(
            code as ArticleAnalyzerErrorCode,
          );
          Object.assign(error, { remoteMessage: "secret-provider-detail" });
          throw error;
        },
      });

      const response = await app.inject({
        method: "POST",
        url: "/analyze",
        payload: validRequest,
      });

      expect(response.statusCode).toBe(statusCode);
      expect(response.json()).toEqual({ error: responseError });
      expect(response.body).not.toContain("secret-provider-detail");
    },
  );

  it("keeps unknown programming errors as generic 500 responses", async () => {
    const app = await serverWith({
      async analyze() {
        throw new Error("secret-programming-detail");
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/analyze",
      payload: validRequest,
    });

    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain("secret-programming-detail");
  });

  it("does not emit article or provider content to logs on analyzer failure", async () => {
    const chunks: string[] = [];
    const loggerStream = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(chunk.toString());
        callback();
      },
    });
    const sentinel = "SENTINEL-ARTICLE-CONTENT-49f1";
    const app = await serverWith(
      {
        async analyze() {
          const error = new ArticleAnalyzerError("provider_error");
          Object.assign(error, { remoteMessage: "SENTINEL-PROVIDER-SECRET" });
          throw error;
        },
      },
      { logger: true, loggerStream },
    );

    const response = await app.inject({
      method: "POST",
      url: "/analyze",
      payload: {
        ...validRequest,
        paragraphs: [{ id: "p0", text: sentinel }],
      },
    });
    await app.close();

    const logs = chunks.join("");
    expect(response.statusCode).toBe(502);
    expect(response.body).not.toContain(sentinel);
    expect(logs).toContain("provider_error");
    expect(logs).not.toContain(sentinel);
    expect(logs).not.toContain("SENTINEL-PROVIDER-SECRET");
  });
});
