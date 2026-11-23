import { atOf, zonedOf } from "../steps/time";
import type { ReceiptRead } from "../../../../../../../src/components/predaja/ReceiptPanel";
import { receiptText as t } from "./messages.hr";

/** "5. 11. 2026. u 21:14", Europe/Zagreb as the prototype writes it; the raw text when the instant cannot be read. */
export const when = atOf;

/** "5. 11. 2026. u 21:14 (UTC+1)": the prototype's zoned(). */
export const zoned = zonedOf;

/** The receipt page of a work, without the base: where a sign-in started on it comes back to. */
export function receiptPath(assignmentId: string): string {
  return `/rad/${encodeURIComponent(assignmentId)}/predaja/potvrda`;
}

export type Row = { readonly id: string; readonly label: string; readonly value: string };

export type ReceiptView =
  | { readonly kind: "loading" }
  | { readonly kind: "error" }
  | { readonly kind: "none" }
  | { readonly kind: "ceka"; readonly title: string; readonly lead: string; readonly rows: readonly Row[]; readonly utc: readonly Row[] }
  | {
    readonly kind: "potvrdeno"; readonly title: string; readonly afterDeadline: boolean; readonly gaps: boolean;
    readonly rows: readonly Row[]; readonly utc: readonly Row[]; readonly fingerprint: string;
  };

/** What step 5 shows for one read: the same words for each variant of the prototype. */
export function receiptView(read: ReceiptRead): ReceiptView {
  if (read.kind === "loading") return { kind: "loading" };
  if (read.kind === "error") return { kind: "error" };
  if (read.kind === "none") return { kind: "none" };
  if (read.kind === "ceka") {
    return {
      kind: "ceka", title: t.titlePending, lead: t.pending.replace("{when}", when(read.requestedAt)),
      rows: [
        { id: "requested", label: t.submittedAt, value: zoned(read.requestedAt) },
        { id: "signed", label: t.signingStarted, value: t.notYetRecorded },
      ],
      utc: [{ id: "requestedAt", label: "requestedAt", value: read.requestedAt }],
    };
  }
  const p = read.receipt.payload;
  return {
    kind: "potvrdeno",
    title: (p.afterDeadline ? t.titleAfterDeadline : t.titleSubmitted).replace("{when}", when(p.requestedAt)),
    afterDeadline: p.afterDeadline, gaps: p.evidenceRecord === "with_gaps", fingerprint: p.artifactSha256,
    rows: [
      { id: "requested", label: t.submittedAt, value: zoned(p.requestedAt) },
      { id: "due", label: t.dueAt, value: zoned(p.dueAt) },
      { id: "signed", label: t.signingStarted, value: zoned(p.signedAt) },
    ],
    utc: [
      { id: "requestedAt", label: "requestedAt", value: p.requestedAt },
      { id: "dueAt", label: "dueAt", value: p.dueAt },
      { id: "signedAt", label: "signedAt", value: p.signedAt },
    ],
  };
}

/** Sixty-four hex characters in groups of four; anything else is not a fingerprint. */
export function fingerprintGroups(value: string): readonly string[] | null {
  return /^[0-9a-f]{64}$/i.test(value) ? (value.match(/.{4}/g) ?? null) : null;
}
