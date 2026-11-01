export interface AnalysisModelRequest {
  instructions: string;
  articleJson: string;
}

export type AnalysisModelResult =
  | { status: "completed"; output: unknown }
  | { status: "refused" }
  | { status: "incomplete" };

export interface AnalysisModelClient {
  analyze(request: AnalysisModelRequest): Promise<AnalysisModelResult>;
}
