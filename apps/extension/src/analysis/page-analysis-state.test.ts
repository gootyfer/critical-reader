import { describe, expect, it } from "vitest";

import {
  finishPageAnalysis,
  getPageReaderUi,
  setPageReaderUi,
  tryStartPageAnalysis,
} from "./page-analysis-state.js";

describe("page analysis state", () => {
  it("allows only one active analysis and permits a later retry", () => {
    const page = {};

    expect(tryStartPageAnalysis(page)).toBe(true);
    expect(tryStartPageAnalysis(page)).toBe(false);

    finishPageAnalysis(page);
    expect(tryStartPageAnalysis(page)).toBe(true);
  });

  it("keeps the current reader UI in stable page-global state", () => {
    const page = {};
    const ui = {
      showLoading() {},
      showError() {},
      renderFindings() {},
      destroy() {},
    };

    setPageReaderUi(page, ui);

    expect(getPageReaderUi(page)).toBe(ui);
  });
});
