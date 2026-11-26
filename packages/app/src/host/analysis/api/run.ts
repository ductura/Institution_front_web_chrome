import { createApi, type ApiOptions, type ApiResult, type Input } from "@/client/api";

const OPERATION = "analysis.runs.post";
export type AnalysisRequest = NonNullable<Input<typeof OPERATION>["body"]>;
export type AnalysisResponse = Extract<ApiResult<typeof OPERATION>, { ok: true }>["body"];

/**
 * Outcomes of one calculation. `off` is the function switched off (404), `unavailable` a 503 or transport failure,
 * `invalid` a refused data set or choice (422, or refused by the client before sending; `code` tells which),
 * `tooLarge` a body over the limit (413), `failed` anything else. The data set is sent only in this body and never kept.
 */
export type AnalysisRun =
  | { kind: "ready"; data: AnalysisResponse }
  | { kind: "off" | "unavailable" | "tooLarge" }
  | { kind: "invalid"; code: string }
  | { kind: "failed"; status: number; code: string };

export type AnalysisRunState = AnalysisRun | { kind: "loading" };

export async function runAnalysis(request: AnalysisRequest, options?: ApiOptions): Promise<AnalysisRun> {
  let answer: ApiResult<typeof OPERATION>;
  try {
    const call = createApi(options);
    answer = await call(OPERATION, { params: undefined, query: undefined, body: request });
  } catch {
    return { kind: "unavailable" };
  }
  if (answer.ok) return { kind: "ready", data: answer.body };
  if (answer.status === 404) return { kind: "off" };
  if (answer.status === 413) return { kind: "tooLarge" };
  if (answer.status === 422 || answer.code === "client_rejected") return { kind: "invalid", code: answer.code };
  if (answer.status === 503) return { kind: "unavailable" };
  return { kind: "failed", status: answer.status, code: answer.code };
}
