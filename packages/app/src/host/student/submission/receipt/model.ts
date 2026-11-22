import { zagrebParts } from "../../../../../../../src/components/summary/zagreb-time";
import { zagrebOffset } from "../../../../../../../src/lib/i18n/zagreb";
import type { ReceiptRead } from "../../../../../../../src/components/predaja/ReceiptPanel";
import { receiptText as t } from "./messages.hr";

/** "12. studenoga 2026. u 21:15", Europe/Zagreb; the raw text when the instant cannot be read. */
export function when(iso: string): string {
  const parts = zagrebParts(iso);
  return parts === null ? iso : `${parts.date} u ${parts.time}`;
}

/** "(UTC+1)" or "(UTC+2)" for the instant, as the prototype's zoned(). */
export function zone(iso: string): string {
  return Number.isNaN(Date.parse(iso)) ? "" : zagrebOffset(iso) === "+01:00" ? "(UTC+1)" : "(UTC+2)";
}

function label(template: string, iso: string): string {
  return template.replace(" {zone}", zone(iso) === "" ? "" : ` ${zone(iso)}`);
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
        { id: "requested", label: label(t.submittedAt, read.requestedAt), value: when(read.requestedAt) },
        { id: "signed", label: label(t.signingStarted, read.requestedAt), value: t.notYetRecorded },
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
      { id: "requested", label: label(t.submittedAt, p.requestedAt), value: when(p.requestedAt) },
      { id: "due", label: label(t.dueAt, p.dueAt), value: when(p.dueAt) },
      { id: "signed", label: label(t.signingStarted, p.signedAt), value: when(p.signedAt) },
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
