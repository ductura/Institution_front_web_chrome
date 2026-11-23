// In-memory stand-in for the N-10 reads (WEB-2157); invented times and sizes only, no real person or text.
import type { ProcessSummaryV1 } from "../../../../../../src/client/process-summary";
import type { DetailsOutcome, N10Port, N10Version, SummaryDetails, ThresholdRow, ThresholdsOutcome, VersionsOutcome } from "./model";

export const FAKE_SUMMARY: ProcessSummaryV1 = {
  summaryFormat: "ductus-process-summary-v1",
  sessions: {
    evidenceKind: "observed", breakAboveMinutes: 30, count: 2,
    items: [
      { from: "2026-10-20T16:05:00.000Z", to: "2026-10-20T17:40:00.000Z" },
      { from: "2026-10-28T08:30:00.000Z", to: "2026-10-28T09:50:00.000Z" },
    ],
  },
  pastes: {
    evidenceKind: "observed", listedAboveCharacters: 200, smallerCount: 1,
    listed: [{ at: { from: "2026-10-20T16:35:00.000Z", to: "2026-10-20T16:35:00.000Z" }, characters: 640, origin: "not_observed" }],
  },
  gaps: { evidenceKind: "observed", items: [{ previousEndedAt: "2026-10-26T20:45:00.000Z", nextStartedAt: "2026-10-28T08:30:00.000Z" }] },
  recordState: "has_gaps",
};

export const FAKE_COMPLETE: ProcessSummaryV1 = { ...FAKE_SUMMARY, gaps: { evidenceKind: "observed", items: [] }, recordState: "complete" };

export const FAKE_EMPTY: ProcessSummaryV1 = {
  summaryFormat: "ductus-process-summary-v1",
  sessions: { evidenceKind: "observed", breakAboveMinutes: 30, count: 0, items: [] },
  pastes: { evidenceKind: "observed", listedAboveCharacters: 200, smallerCount: 0, listed: [] },
  gaps: { evidenceKind: "observed", items: [] },
  recordState: "complete",
};

export const FAKE_DETAILS: SummaryDetails = {
  activeEditingMinutes: 175,
  keyEvents: [{ kind: "ai-transfer", at: { from: "2026-10-28T09:05:00.000Z", to: "2026-10-28T09:05:00.000Z" } }],
};

export const FAKE_VERSIONS: readonly N10Version[] = [
  { kind: "submission", revision: 1, savedMinute: "2026-10-28T09:50:00.000Z" },
  { kind: "checkpoint", revision: 3, savedMinute: "2026-11-01T09:00:00.000Z" },
  { kind: "submission", revision: 4, savedMinute: "2026-11-05T20:14:00.000Z" },
];

/** Invented faculty rules, one kind in each of the three states (P-1 demo: unknown origin and assistant). */
export const FAKE_THRESHOLDS: readonly ThresholdRow[] = [
  { origin: "assistant_inserted", state: "in_line" },
  { origin: "pasted_known", state: "for_review" },
  { origin: "pasted_unknown", state: "exceeded" },
];

export function fakeN10Port(
  summary: ProcessSummaryV1 | "signedOut" | "notFound" | "unavailable" = FAKE_SUMMARY,
  details: DetailsOutcome = { kind: "ok", details: FAKE_DETAILS },
  versions: VersionsOutcome = { kind: "ready", versions: FAKE_VERSIONS },
  thresholds: ThresholdsOutcome = { kind: "ok", rows: [] },
): N10Port {
  return {
    summary: async () => (typeof summary === "string" ? { kind: summary } : { kind: "ok", summary }),
    details: async () => details,
    versions: async () => versions,
    thresholds: async () => thresholds,
  };
}
