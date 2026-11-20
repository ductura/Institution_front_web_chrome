// Types only: the process summary as the fast path record and the summary view
// read it (Ductus ProcessSummaryV1). The projection that builds it stays on the
// server; the web reads it through the generated client. Shape taken from the readers
// (ProcessSummaryView, fast-path) and the demo catalogue.
export type EvidenceKind = "observed" | "imported" | "declared";

/** A span between two instants, to the minute. */
export interface MinuteSpan {
  readonly from: string;
  readonly to: string;
}

export interface ProcessSummaryV1 {
  readonly summaryFormat: "ductus-process-summary-v1";
  readonly sessions: {
    readonly evidenceKind: EvidenceKind;
    readonly breakAboveMinutes: number;
    readonly count: number;
    readonly items: readonly MinuteSpan[];
  };
  readonly pastes: {
    readonly evidenceKind: EvidenceKind;
    readonly listedAboveCharacters: number;
    readonly listed: readonly { readonly at: MinuteSpan; readonly characters: number; readonly origin: "not_observed" }[];
    readonly smallerCount: number;
  };
  readonly gaps: {
    readonly evidenceKind: EvidenceKind;
    readonly items: readonly { readonly previousEndedAt: string; readonly nextStartedAt: string }[];
  };
  readonly recordState: "complete" | "has_gaps";
}
