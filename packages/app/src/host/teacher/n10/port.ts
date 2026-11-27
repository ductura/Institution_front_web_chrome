// The real port of N-10: three reads of src/client through createApi with the generated contract.
//   projection.process-summary.post          the summary (the same bytes the student gets)
//   projection.process-summary-details.post  active editing minutes and key events (AI transfers, imports)
//   work.versions.get                         saved versions; only submissions are shown
//   work.origin-thresholds.get                faculty rules: one of three labels per origin kind (P-1 rule 12)
// `current()` is asked before each request: once the session has ended nothing is sent (F-093).
import { createApi, type ApiOptions } from "../../../../../../src/client/api";
import { fetchProcessSummary, summaryAgrees } from "../../../../../../src/client/process-summary";
import { readTimeMachineVersions } from "../../../../../../src/client/time-machine";
import { thresholdRows, type DetailsOutcome, type N10Port, type NotesOutcome, type ThresholdsOutcome } from "./model";

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

export async function readOriginThresholds(documentId: string, current: () => boolean, options: ApiOptions = {}): Promise<ThresholdsOutcome> {
  if (!current()) return { kind: "signedOut" };
  try {
    const result = await createApi(options)("work.origin-thresholds.get", { params: { documentId }, query: undefined, body: undefined });
    if (!result.ok) return { kind: result.status === 401 ? "signedOut" : result.status === 404 ? "notFound" : "unavailable" };
    const rows = result.status === 200 ? thresholdRows(result.body.comparison) : null;
    return rows === null ? { kind: "unavailable" } : { kind: "ok", rows };
  } catch {
    return { kind: "unavailable" };
  }
}

/**
 * The student's notes at the submission: teacher.work.get names the student and the assignment of the work, then
 * teacher.submission-notes.get gives the notes. Someone else's work or student is a 404 (notFound), never an empty list.
 */
export async function readSubmissionNotes(documentId: string, current: () => boolean, options: ApiOptions = {}): Promise<NotesOutcome> {
  if (!current()) return { kind: "signedOut" };
  try {
    const call = createApi(options);
    const work = await call("teacher.work.get", { params: { documentId }, query: undefined, body: undefined });
    if (!work.ok) return { kind: work.status === 401 ? "signedOut" : work.status === 404 ? "notFound" : "unavailable" };
    if (work.body.documentId !== documentId) return { kind: "unavailable" };
    if (!current()) return { kind: "signedOut" };
    const { assignmentId, studentId } = work.body;
    const result = await call("teacher.submission-notes.get", { params: { assignmentId, studentId }, query: undefined, body: undefined });
    if (!result.ok) return { kind: result.status === 401 ? "signedOut" : result.status === 404 ? "notFound" : "unavailable" };
    if (result.status !== 200) return { kind: "unavailable" };
    return { kind: "ok", notes: result.body.notes.map(({ id, text, createdAt }) => ({ id, text, createdAt })) };
  } catch {
    return { kind: "unavailable" };
  }
}

export function n10Port(current: () => boolean): N10Port {
  return {
    summary: (documentId) => fetchProcessSummary(documentId, current),
    details: (documentId) => readSummaryDetails(documentId, current),
    versions: async (documentId) => (current() ? readTimeMachineVersions(documentId) : { kind: "signedOut" }),
    thresholds: (documentId) => readOriginThresholds(documentId, current),
    notes: (documentId) => readSubmissionNotes(documentId, current),
  };
}
