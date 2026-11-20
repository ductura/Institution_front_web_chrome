/**
 * The process summary read (F-10, WEB-34; projection.process-summary.post,
 * contract 2.9.1). Ported from Ductus src/client/process-summary.ts at
 * 0cdb0f1 onto createApi: the body names the document and nothing else, so
 * the student and the teacher send the same request and get the same bytes
 * (PRODUCT §5 rule 5, D-80 point 6). The server logs a teacher's read
 * (rule 17).
 *
 * createApi already holds a 200 to the contract's closed schema. On top of
 * that a summary is shown only when it agrees with itself: the counts match
 * their lists, every span and every gap runs forward, a listed paste is above the threshold
 * and the record state is the one its gap list says. Anything else is
 * `unavailable` and never reaches the screen.
 */

import { browserTransport, createApi, type ApiOptions, type ApiResult } from "./api";

/** The summary exactly as the contract gives it (the same type as ProcessSummaryView in #120). */
export type ProcessSummaryV1 = Extract<ApiResult<"projection.process-summary.post">, { ok: true }>["body"];

export type SummaryOutcome =
  | { kind: "ok"; summary: ProcessSummaryV1 }
  | { kind: "signedOut" | "notFound" | "unavailable" };

const forward = (span: { from: string; to: string }) => span.from <= span.to;

/** True when a summary that matches the schema also agrees with itself. */
export function summaryAgrees(summary: ProcessSummaryV1): boolean {
  const { sessions, pastes, gaps, recordState } = summary;
  return sessions.count === sessions.items.length
    && sessions.items.every(forward)
    && pastes.listed.every((paste) => forward(paste.at) && paste.characters > pastes.listedAboveCharacters)
    && gaps.items.every((gap) => gap.previousEndedAt <= gap.nextStartedAt)
    && recordState === (gaps.items.length === 0 ? "complete" : "has_gaps");
}

/**
 * Asks for the summary of `documentId`. `current()` is asked right before the
 * request: once the session has ended in this browser nothing is sent (F-093).
 */
export async function fetchProcessSummary(
  documentId: string,
  current: () => boolean = () => true,
  options: ApiOptions = {},
): Promise<SummaryOutcome> {
  if (!current()) return { kind: "signedOut" };
  const api = createApi({ fetchImpl: browserTransport, ...options });
  let result: ApiResult<"projection.process-summary.post">;
  try {
    result = await api("projection.process-summary.post", { params: undefined, query: undefined, body: { documentId } });
  } catch {
    return { kind: "unavailable" };
  }
  if (!result.ok) {
    if (result.status === 401) return { kind: "signedOut" };
    return { kind: result.status === 404 ? "notFound" : "unavailable" };
  }
  return result.status === 200 && summaryAgrees(result.body) ? { kind: "ok", summary: result.body } : { kind: "unavailable" };
}
