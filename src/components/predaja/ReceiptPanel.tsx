/**
 * The submission receipt (WEB-27, S: E-11), the one home of this component:
 * the student's step 5 and the teacher's N-07 (WEB-35) render it unchanged,
 * so both see the same receipt in the same words (PRODUCT §5 rule 5).
 *
 * Pure: the read comes in, so each variant renders with
 * `renderToStaticMarkup`. "Predano" only with the signed receipt the client
 * checked against the contract (B-6); `ceka` (recorded, not signed yet)
 * never says it. Times are in Europe/Zagreb, each with its UTC instant in the
 * details. The browser does not check the Ed25519 signature (P-4) and the
 * panel says so. Not built here: /provjera, QR and PDF (wave 9).
 */

import { Fingerprint, KeyValueList, StateTag, type KeyValueItem } from "@ductura/ui";

import type { SubmissionRead, SubmissionReceipt } from "@/client/submission";
import { messagesHr } from "@/lib/i18n/messages.hr";

import { zagrebParts } from "../summary/zagreb-time";

const t = messagesHr.receipt;

/** What the panel shows; `none` is variant prazno: the server holds no signed receipt. */
export type ReceiptRead =
  | { readonly kind: "loading" }
  | { readonly kind: "error" }
  | { readonly kind: "none" }
  | { readonly kind: "ceka"; readonly revision: number; readonly requestedAt: string }
  | { readonly kind: "potvrdeno"; readonly receipt: SubmissionReceipt };

/**
 * The student's read of step 5 from student.submission.get and the work
 * state of student.assignment-work.get (null when it could not be read). A
 * receipt or a pending signature is shown as read; a submitted work without
 * a readable receipt is an error, never "predano" and never "prazno".
 */
export function studentReceiptRead(read: SubmissionRead, workState: string | null): ReceiptRead {
  if (read.kind === "potvrdeno") return { kind: "potvrdeno", receipt: read.receipt };
  if (read.kind === "ceka") return { kind: "ceka", revision: read.revision, requestedAt: read.requestedAt };
  if (read.kind === "none" && workState !== "submitted") return { kind: "none" };
  // Unknown, refused or contradicted by the work state: the page cannot say which.
  return workState === null || workState === "submitted" ? { kind: "error" } : { kind: "none" };
}

function zagreb(iso: string): string {
  const parts = zagrebParts(iso);
  return parts === null ? iso : `${parts.date} ${messagesHr.summary.at} ${parts.time}`;
}

function timeItem(id: string, label: string, iso: string): KeyValueItem {
  return { id, label, value: zagreb(iso), details: { summary: t.utc, children: <code>{iso}</code> } };
}

export type ReceiptPanelProps = {
  readonly read: ReceiptRead;
  /** The same page again: "Pokušaj ponovno" and "Provjeri stanje predaje" read anew. */
  readonly retryHref: string;
  /** The process summary of this work (PD-1), as the reader reaches it. */
  readonly summaryHref?: string;
  /** Where a work without a receipt goes on (variant prazno); omitted for a reader who cannot submit. */
  readonly submitHref?: string;
};

export function ReceiptPanel({ read, retryHref, summaryHref, submitHref }: ReceiptPanelProps) {
  if (read.kind === "loading") return <p role="status">{t.loading}</p>;
  if (read.kind === "error") {
    return (
      <div className="receipt">
        <p role="alert">{t.error}</p>
        <p><a href={retryHref}>{t.retry}</a></p>
      </div>
    );
  }
  if (read.kind === "none") {
    return (
      <div className="receipt">
        <p role="status">{t.empty}</p>
        {submitHref !== undefined && <p><a href={submitHref}>{t.toSubmit}</a></p>}
      </div>
    );
  }
  if (read.kind === "ceka") {
    return (
      <div className="receipt">
        <p><StateTag state="pending" /></p>
        <p role="status">{t.waiting}</p>
        <KeyValueList items={[
          timeItem("requested", t.signingStarted, read.requestedAt),
          { id: "revision", label: t.revision, value: String(read.revision) },
        ]} />
        <p><a href={retryHref}>{t.check}</a></p>
      </div>
    );
  }
  const p = read.receipt.payload;
  const gaps = p.evidenceRecord === "with_gaps";
  const items: KeyValueItem[] = [
    timeItem("requested", t.submittedAt, p.requestedAt),
    timeItem("due", t.dueAt, p.dueAt),
    timeItem("signed", t.signedAt, p.signedAt),
    { id: "version", label: t.assignmentVersion, value: String(p.assignmentVersion) },
    { id: "revision", label: t.revision, value: String(p.revision) },
    { id: "record", label: t.record, value: t.records[p.evidenceRecord] },
    {
      id: "fingerprint", label: t.fingerprint,
      value: <><Fingerprint value={p.artifactSha256} /><span className="receipt__note">{t.fingerprintNote}</span></>,
    },
  ];
  return (
    <div className="receipt">
      <p className="receipt__state">
        <StateTag state="submitted" />
        {p.afterDeadline && <StateTag state="late" />}
        {gaps && <StateTag state="gap" />}
      </p>
      {p.afterDeadline && <p role="note">{t.late}</p>}
      <KeyValueList items={items} />
      {summaryHref !== undefined && <p><a href={summaryHref}>{t.summary}</a></p>}
      <p>{t.signatureNote}</p>
    </div>
  );
}
