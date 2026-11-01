import { describe, expect, it, vi } from "vitest";

import type { AnalyzeRequest } from "@critical-reader/contracts";

import {
  AnalysisRequestError,
  requestAnalysis,
} from "./request-analysis.js";

const input: AnalyzeRequest = {
  title: "Artículo",
  subtitle: "",
  language: "es",
  paragraphs: [{ id: "p0", text: "Contenido." }],
};

const validResponse = {
  findings: [
    {
      paragraphId: "p0",
      category: "sexism",
      mechanism: "stereotype",
      explanation: "Explicación válida.",
    },
  ],
};

const requestConfig = {
  endpoint: "https://critical-reader-api.vercel.app/analyze",
  clientVersion: "0.2.0",
};

describe("requestAnalysis", () => {
  it("posts the article to the configured API with its client version", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(validResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(requestAnalysis(fetchFn, input, requestConfig)).resolves.toEqual(validResponse);
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(fetchFn).toHaveBeenCalledWith(requestConfig.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Critical-Reader-Version": "0.2.0",
      },
      body: JSON.stringify(input),
    });
  });

  it("rejects a non-successful HTTP response without exposing its body", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("sensitive upstream detail", { status: 500 }));

    await expect(requestAnalysis(fetchFn, input, requestConfig)).rejects.toMatchObject({
      name: "AnalysisRequestError",
      code: "http_error",
      message: "The analysis service returned an error",
    });
  });

  it("wraps network failures in a stable error", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("connection details"));

    await expect(requestAnalysis(fetchFn, input, requestConfig)).rejects.toMatchObject({
      name: "AnalysisRequestError",
      code: "network_error",
      message: "The analysis service is unavailable",
    });
  });

  it("rejects JSON that does not satisfy the response contract", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          findings: [
            {
              paragraphId: "p0",
              category: "unsupported",
              mechanism: "stereotype",
              explanation: "Explicación válida.",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const error = await requestAnalysis(fetchFn, input, requestConfig).catch(
      (reason: unknown) => reason,
    );

    expect(error).toBeInstanceOf(AnalysisRequestError);
    expect(error).toMatchObject({
      code: "invalid_response",
      message: "The analysis service returned an invalid response",
    });
  });

  it("rejects a response body that is not JSON", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("not json", { status: 200 }));

    await expect(requestAnalysis(fetchFn, input, requestConfig)).rejects.toMatchObject({
      name: "AnalysisRequestError",
      code: "invalid_response",
    });
  });
});
