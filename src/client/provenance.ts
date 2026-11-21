// The entry-method share of a submitted version (WEB-1220, N-AI-ATT variant U) behind a port.
// The contract provenance-share-v1 (SRV-1220) is still a proposal and its route (SRV-1221) is
// not merged, so there is no route and no wire shape here. The shapes are the view's
// (`ProvenanceShareState` of @ductura/ui), repeated because this package does not depend on the
// UI package; the pages pass a read straight to `ProvenanceShare`, so tsc keeps the two in step.
// Only the fake in provenance-fake.ts implements the port.

export type ShareCategory = "written" | "ai_transferred" | "pasted" | "imported" | "unattributed";

export type ShareRecord = {
  readonly unit: "code_point";
  readonly totalCodePoints: number;
  readonly categories: readonly { readonly category: ShareCategory; readonly codePoints: number; readonly percent: number }[];
  readonly notice: "not_authorship_evidence";
};

export type AiMatchRecord = {
  readonly normalization: string;
  readonly minMatchCodePoints: number;
  readonly spans: readonly { readonly blockId: string; readonly from: number; readonly to: number }[];
  readonly notice: "not_authorship_evidence";
};

/** What a read can answer: the view's states without `loading`, which belongs to the screen. */
export type ProvenanceRead =
  | { readonly kind: "pending" | "none" | "disabled" | "error" }
  | {
      readonly kind: "ready";
      readonly share: ShareRecord;
      /** Absent: no match marker for this submission. */
      readonly aiMatch?: AiMatchRecord;
      readonly blocks: readonly { readonly id: string; readonly text: string }[];
    };

/**
 * One read for both readers: the student and the teacher of a submission get the same answer,
 * so the port takes no role, no threshold and no sort order.
 */
export interface ProvenancePort {
  read(submissionId: string): Promise<ProvenanceRead>;
}
