// The real port of N-10: three reads of src/client through createApi with the generated contract.
//   projection.process-summary.post          the summary (the same bytes the student gets)
//   projection.process-summary-details.post  active editing minutes and key events (AI transfers, imports)
//   work.versions.get                         saved versions; only submissions are shown
// `current()` is asked before each request: once the session has ended nothing is sent (F-093).
import { createApi, type ApiOptions } from "../../../../../../src/client/api";
import { fetchProcessSummary, summaryAgrees } from "../../../../../../src/client/process-summary";
import { readTimeMachineVersions } from "../../../../../../src/client/time-machine";
import type { DetailsOutcome, N10Port } from "./model";

export async function readSummaryDetails(documentId: string, current: () => boolean, options: ApiOptions = {}): Promise<DetailsOutcome> {
  if (!current()) return { kind: "signedOut" };
  try {
    const call = createApi(options);
    const result = await call("projection.process-summary-details.post", { params: undefined, query: undefined, body: { documentId } });
    if (!result.ok) return { kind: result.status === 401 ? "signedOut" : result.status === 404 ? "notFound" : "unavailable" };
    const { summary, activeEditingMinutes, keyEvents } = result.body;
    if (result.status !== 200 || !summaryAgrees(summary) || !keyEvents.every((e) => e.at.from <= e.at.to)) return { kind: "unavailable" };
    return { kind: "ok", details: { activeEditingMinutes, keyEvents: keyEvents.map(({ kind, at }) => ({ kind, at: { from: at.from, to: at.to } })) } };
  } catch {
    return { kind: "unavailable" };
  }
}

export function n10Port(current: () => boolean): N10Port {
  return {
    summary: (documentId) => fetchProcessSummary(documentId, current),
    details: (documentId) => readSummaryDetails(documentId, current),
    versions: async (documentId) => (current() ? readTimeMachineVersions(documentId) : { kind: "signedOut" }),
  };
}
