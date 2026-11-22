"use client";

import { useId, useState, type FormEvent } from "react";

import { Button } from "../Button";
import { Checkbox } from "../Checkbox";
import { Select } from "../Select";
import { TextField } from "../TextField";
import styles from "./StudentDataExport.module.css";

export type IdentityDocument = "identity_card" | "passport" | "student_card";
export type ExportState = "requested" | "approved" | "ready" | "downloaded" | "expired";

/** One export request as the administrator sees it; the times are display text, already formatted. */
export type ExportRow = {
  readonly exportId: string;
  readonly state: ExportState;
  readonly requestedAt: string;
  /** When the download link stops working; null while there is no link. */
  readonly expiresAt: string | null;
};

export type StudentDataExportLabels = {
  // The registry office's request form.
  requestTitle: string;
  requestLead: string;
  studentId: string;
  studentIdHint: string;
  studentIdMissing: string;
  identityDocument: string;
  identityDocumentPick: string;
  identityDocumentMissing: string;
  documents: Readonly<Record<IdentityDocument, string>>;
  identityConfirmed: string;
  identityNotConfirmed: string;
  note: string;
  noteHint: string;
  noteMissing: string;
  request: string;
  requesting: string;
  // The administrator's list.
  listTitle: string;
  listLead: string;
  empty: string;
  loading: string;
  retry: string;
  states: Readonly<Record<ExportState, string>>;
  requestedAt: (at: string) => string;
  expiresAt: (at: string) => string;
  approve: string;
  approveTitle: string;
  reference: string;
  referenceHint: string;
  referenceMissing: string;
  approving: string;
  cancel: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DOCUMENTS: readonly IdentityDocument[] = ["identity_card", "passport", "student_card"];

export type StudentDataExportRequestProps = {
  labels: StudentDataExportLabels;
  onRequest: (input: { studentId: string; identityCheckedBy: IdentityDocument; note: string }) => void;
  busy?: boolean;
  /** The catalogue text of a refused request (e.g. 403, 409); shown under the form. */
  actionError?: string;
};

/**
 * The registry office's request for a student's data export (WEB-1302): the student, the
 * document the identity was checked on, a confirmation that it was checked, and a short note.
 * The values are checked here only for the user's sake; the server decides.
 */
export function StudentDataExportRequest({ labels, onRequest, busy = false, actionError }: StudentDataExportRequestProps) {
  const [studentId, setStudentId] = useState("");
  const [identityDoc, setIdentityDoc] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Partial<Record<"studentId" | "document" | "confirmed" | "note", string>>>({});

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const id = studentId.trim().toLowerCase();
    const found = {
      ...(UUID.test(id) ? {} : { studentId: labels.studentIdMissing }),
      ...(DOCUMENTS.includes(identityDoc as IdentityDocument) ? {} : { document: labels.identityDocumentMissing }),
      ...(confirmed ? {} : { confirmed: labels.identityNotConfirmed }),
      ...(note.trim() === "" ? { note: labels.noteMissing } : {}),
    };
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onRequest({ studentId: id, identityCheckedBy: identityDoc as IdentityDocument, note: note.trim() });
  };

  return (
    <section className={styles.root} aria-label={labels.requestTitle}>
      <h2 className={styles.title}>{labels.requestTitle}</h2>
      <p className={styles.lead}>{labels.requestLead}</p>
      <form className={styles.form} onSubmit={submit} noValidate>
        <TextField label={labels.studentId} hint={labels.studentIdHint} error={errors.studentId} value={studentId}
          maxLength={36} autoComplete="off" spellCheck={false} onChange={(event) => setStudentId(event.target.value)} />
        <Select label={labels.identityDocument} placeholder={labels.identityDocumentPick} error={errors.document} value={identityDoc}
          options={DOCUMENTS.map((value) => ({ value, label: labels.documents[value] }))}
          onChange={(event) => setIdentityDoc(event.target.value)} />
        <Checkbox label={labels.identityConfirmed} error={errors.confirmed} checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)} />
        <TextField label={labels.note} hint={labels.noteHint} error={errors.note} value={note} maxLength={80}
          onChange={(event) => setNote(event.target.value)} />
        {actionError === undefined ? null : <p role="alert" className={styles.alert}>{actionError}</p>}
        <div className={styles.actions}>
          <Button type="submit" busy={busy}>{busy ? labels.requesting : labels.request}</Button>
        </div>
      </form>
    </section>
  );
}

export type StudentDataExportListState =
  | { readonly kind: "loading" }
  /** `message` is the catalogue text for the server's answer, never a raw code. */
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "ready"; readonly exports: readonly ExportRow[] };

export type StudentDataExportListProps = {
  labels: StudentDataExportLabels;
  state: StudentDataExportListState;
  onApprove: (exportId: string, reference: string) => void;
  onRetry?: () => void;
  busy?: boolean;
  actionError?: string;
};

function ApproveForm({ row, labels, busy, onApprove, onCancel }: {
  row: ExportRow; labels: StudentDataExportLabels; busy: boolean; onApprove: (id: string, reference: string) => void; onCancel: () => void;
}) {
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | undefined>();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (reference.trim() === "") return setError(labels.referenceMissing);
    setError(undefined);
    onApprove(row.exportId, reference.trim());
  };
  return (
    <form className={styles.form} onSubmit={submit} aria-label={labels.approveTitle} noValidate>
      <TextField label={labels.reference} hint={labels.referenceHint} error={error} value={reference} maxLength={120}
        onChange={(event) => { setReference(event.target.value); setError(undefined); }} autoFocus />
      <div className={styles.actions}>
        <Button type="submit" busy={busy}>{busy ? labels.approving : labels.approve}</Button>
        <Button tone="quiet" onClick={onCancel}>{labels.cancel}</Button>
      </div>
    </form>
  );
}

/**
 * The administrator's list of export requests (WEB-1302): each request's state as a word and,
 * once there is a link, the time it expires (a time, never a countdown). A request still
 * waiting has "Pokreni izvoz", which asks for the approval reference first.
 */
export function StudentDataExportList({ labels, state, onApprove, onRetry, busy = false, actionError }: StudentDataExportListProps) {
  const [approving, setApproving] = useState<string | null>(null);
  const headingId = useId();
  return (
    <section className={styles.root} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.title}>{labels.listTitle}</h2>
      <p className={styles.lead}>{labels.listLead}</p>
      {actionError === undefined ? null : <p role="alert" className={styles.alert}>{actionError}</p>}
      {state.kind === "loading" ? (
        <p role="status" className={styles.meta}>{labels.loading}</p>
      ) : state.kind === "error" ? (
        <div className={styles.fail}>
          <p role="alert" className={styles.alert}>{state.message}</p>
          {onRetry === undefined ? null : <Button tone="quiet" onClick={onRetry}>{labels.retry}</Button>}
        </div>
      ) : state.exports.length === 0 ? (
        <p className={styles.meta}>{labels.empty}</p>
      ) : (
        <ul className={styles.list}>
          {state.exports.map((row) => (
            <li key={row.exportId} className={styles.item} data-state={row.state}>
              <p className={styles.state}>{labels.states[row.state]}</p>
              <p className={styles.meta}>{labels.requestedAt(row.requestedAt)}</p>
              {row.expiresAt === null ? null : <p className={styles.meta}>{labels.expiresAt(row.expiresAt)}</p>}
              {row.state !== "requested" ? null : approving === row.exportId ? (
                <ApproveForm row={row} labels={labels} busy={busy} onApprove={onApprove} onCancel={() => setApproving(null)} />
              ) : (
                <Button tone="quiet" onClick={() => setApproving(row.exportId)}>{labels.approve}</Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export type StudentDataDownloadLabels = {
  title: string;
  lead: string;
  download: string;
  downloading: string;
  done: string;
  /** The link was used, has expired or is unknown (410). */
  gone: string;
};

export type StudentDataDownloadState =
  | { readonly kind: "idle" }
  | { readonly kind: "busy" }
  | { readonly kind: "done" }
  | { readonly kind: "gone" }
  | { readonly kind: "error"; readonly message: string };

/**
 * The student's one-time download (WEB-1302). The link works once, so nothing is read before
 * the student presses the button; after a 410 the button is gone and the page says why.
 */
export function StudentDataDownload({ labels, state, onDownload }: {
  labels: StudentDataDownloadLabels; state: StudentDataDownloadState; onDownload: () => void;
}) {
  const busy = state.kind === "busy";
  return (
    <section className={styles.root} aria-label={labels.title}>
      <h2 className={styles.title}>{labels.title}</h2>
      {state.kind === "gone" ? (
        <p role="alert" className={styles.alert}>{labels.gone}</p>
      ) : state.kind === "done" ? (
        <p role="status" className={styles.lead}>{labels.done}</p>
      ) : (
        <>
          <p className={styles.lead}>{labels.lead}</p>
          {state.kind === "error" ? <p role="alert" className={styles.alert}>{state.message}</p> : null}
          <div className={styles.actions}>
            <Button busy={busy} onClick={() => { if (!busy) onDownload(); }}>{busy ? labels.downloading : labels.download}</Button>
          </div>
        </>
      )}
    </section>
  );
}
