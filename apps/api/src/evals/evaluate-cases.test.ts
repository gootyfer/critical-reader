import { describe, expect, it, vi } from "vitest";

import { OPENAI_EVALUATION_CASES } from "./openai-cases.js";
import { runEvaluation } from "./evaluate-cases.js";

describe("runEvaluation", () => {
  it("runs frozen cases sequentially and logs only aggregate-safe data", async () => {
    let active = 0;
    let maximumActive = 0;
    let index = 0;
    const analyze = vi.fn(async () => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      const output = OPENAI_EVALUATION_CASES[index++]!.expected;
      active -= 1;
      return output;
    });
    const lines: string[] = [];

    const result = await runEvaluation(
      { analyze },
      OPENAI_EVALUATION_CASES,
      (line) => lines.push(line),
      (() => {
        let time = 0;
        return () => (time += 10);
      })(),
    );

    expect(result.exitCode).toBe(0);
    expect(result.metrics.accepted).toBe(true);
    expect(analyze).toHaveBeenCalledTimes(21);
    expect(maximumActive).toBe(1);
    expect(lines.join("\n")).toContain("positive_sexism_stereotype");
    expect(lines.join("\n")).not.toContain(
      OPENAI_EVALUATION_CASES[0]!.request.paragraphs[1]!.text,
    );
  });

  it("records an analyzer failure and returns a non-zero exit code", async () => {
    const lines: string[] = [];

    const result = await runEvaluation(
      { async analyze() { throw new Error("secret provider body"); } },
      [OPENAI_EVALUATION_CASES[0]!],
      (line) => lines.push(line),
      () => 0,
    );

    expect(result.exitCode).toBe(1);
    expect(result.metrics.failedCases).toBe(1);
    expect(lines.join("\n")).not.toContain("secret provider body");
  });
});
