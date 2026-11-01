import type { ReaderUi } from "../ui/reader-ui.js";

const PAGE_STATE_KEY = Symbol.for("critical-reader.page-analysis-state");

interface PageAnalysisState {
  active: boolean;
  readerUi?: ReaderUi;
}

const stateFor = (page: object): PageAnalysisState => {
  const target = page as Record<symbol, PageAnalysisState | undefined>;
  const existing = target[PAGE_STATE_KEY];
  if (existing) return existing;

  const created: PageAnalysisState = { active: false };
  target[PAGE_STATE_KEY] = created;
  return created;
};

export function tryStartPageAnalysis(page: object): boolean {
  const state = stateFor(page);
  if (state.active) return false;
  state.active = true;
  return true;
}

export function finishPageAnalysis(page: object): void {
  stateFor(page).active = false;
}

export function getPageReaderUi(page: object): ReaderUi | undefined {
  return stateFor(page).readerUi;
}

export function setPageReaderUi(page: object, ui: ReaderUi): void {
  stateFor(page).readerUi = ui;
}
