"use client";

import { Button, Card, Steps } from "@ductura/ui";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { useOnline } from "@/client/online-status";
import { addNote, readNotes, type LocalCall, type Read, type SubmissionNote } from "@/client/submission";
import { countHr } from "@/lib/i18n/hr";
import { messagesHr } from "@/lib/i18n/messages.hr";

import { ProcessSummaryView, type ProcessSummaryV1 } from "../summary/ProcessSummaryView";
import { zagrebParts } from "../summary/zagreb-time";
import styles from "./BeforeSubmit.module.css";
import { confirmationKey, readConfirmed } from "./Declaration";
import { NoteDialog, type NoteAdded } from "./NoteDialog";

const t = messagesHr.beforeSubmit;
const s = messagesHr.summary;

/**
 * TODO(ugovor): the student's read of the process summary (SRV-23) is not in
 * the published contract yet; until then the page passes `error`, which never
 * holds the flow (§5 rule 11).
 */
export type SummaryRead =
  | { readonly kind: "ready"; readonly summary: ProcessSummaryV1 }
  | { readonly kind: "loading" }
  | { readonly kind: "error" };

export type NotesRead =
  | { readonly kind: "ready"; readonly notes: readonly SubmissionNote[] }
  | { readonly kind: "loading" }
  | { readonly kind: "unavailable" };

/** Where the assignment stands, from student.assignments.get and student.assignment-work.get. */
export type Stage =
  | { readonly kind: "open" }
  | { readonly kind: "closed"; readonly dueAt: string }
  | { readonly kind: "submitted" }
  | { readonly kind: "unavailable" };

/** The stage of a work: submitted first, then the deadline against `now`. */
export function stageOf(workState: string, dueAt: string, now: number): Stage {
  if (workState === "submitted") return { kind: "submitted" };
  const due = Date.parse(dueAt);
  return Number.isFinite(due) && due < now ? { kind: "closed", dueAt } : { kind: "open" };
}

/** The pasted row: each number with its threshold, nothing summed (§5 rule 12). Never holds the flow. */
export function pastedText(summary: SummaryRead): string {
  if (summary.kind !== "ready") return t.pastedUnknown;
  const { pastes } = summary.summary;
  const chars = s.units.charactersGenitive;
  const above = countHr(pastes.listedAboveCharacters, chars.one, chars.few, chars.many);
  return `${t.pastedCount}: ${pastes.listed.length} (${s.pastes.listedThreshold} ${above}); `
    + `${t.pastedSmaller}: ${pastes.smallerCount}. ${t.pastedInfo}`;
}

function dueText(iso: string): string {
  const parts = zagrebParts(iso);
  return parts === null ? iso : `${parts.date} ${s.at} ${parts.time}`;
}

export type BeforeSubmitViewProps = {
  readonly summary: SummaryRead;
  readonly notes: NotesRead;
  readonly stage: Stage;
  readonly confirmed: boolean;
  readonly online: boolean;
  readonly onNext: () => void;
  readonly onDeclaration: () => void;
  readonly onBack: () => void;
  readonly onReceipt: () => void;
  readonly onRetry: () => void;
  readonly onOpenNote: () => void;
};

/**
 * S: E-8, step 3 of the submission (WEB-25). The checks inform; only an
 * unconfirmed declaration sends the student back to step 2 (C-3). Pastes,
 * gaps in the record and the form check never hold the submission (§5 rule
 * 11). The right column is the process summary as the server gives it
 * (PD-1), the same view the teacher sees (§5 rule 5).
 */
export function BeforeSubmitView(props: BeforeSubmitViewProps) {
  const { summary, notes, stage, confirmed, online } = props;
  const hint = useId();
  const submitted = stage.kind === "submitted";
  const canAddNote = !submitted && online && notes.kind === "ready";
  const nextHint = !online ? t.offline : confirmed ? undefined : t.declarationMissing;
  return (
    <div className="page before-submit">
      <Steps currentStep={3} />
      <h1>{t.title}</h1>
      {stage.kind === "closed" && <p role="note">{`${t.closed}: ${dueText(stage.dueAt)}.`}</p>}
      {stage.kind === "unavailable" && <p role="alert">{t.unavailable}</p>}
      {submitted && <p role="status">{t.submitted}</p>}
      {!online && !submitted && <p role="status">{t.offline}</p>}
      <div className={styles.layout}>
        <div className={styles.checks}>
          <Card title={t.checks}>
            <dl className={styles.rows}>
              <dt>{t.declaration}</dt>
              <dd>{confirmed ? t.declarationConfirmed : t.declarationMissing}</dd>
              <dt>{t.placeholders}</dt>
              <dd>{t.placeholdersInfo}</dd>
              <dt>{t.pasted}</dt>
              <dd>{pastedText(summary)}</dd>
              <dt>{t.form}</dt>
              <dd>{t.formNotRun}</dd>
            </dl>
          </Card>
          <Card title={t.notes} busy={notes.kind === "loading"}
            error={notes.kind === "unavailable" ? t.notesUnavailable : undefined}>
            {notes.kind === "ready" && (notes.notes.length === 0
              ? <p>{t.notesNone}</p>
              : <ol>{notes.notes.map((note) => <li key={note.id}>{note.text}</li>)}</ol>)}
          </Card>
          {!submitted && (
            <p>
              <Button tone="quiet" disabled={!canAddNote} onClick={props.onOpenNote}>{t.addNote}</Button>
            </p>
          )}
        </div>
        <aside>
          {summary.kind === "ready" ? <ProcessSummaryView summary={summary.summary} />
            : <Card title={s.title} busy={summary.kind === "loading"} error={summary.kind === "error" ? t.summaryError : undefined} />}
          {summary.kind === "loading" && <p role="status">{t.summaryLoading}</p>}
          {summary.kind === "error" && <Button tone="quiet" onClick={props.onRetry}>{t.retry}</Button>}
        </aside>
      </div>
      {submitted ? (
        <p>
          <Button onClick={props.onReceipt}>{t.receipt}</Button>
          <Button tone="quiet" onClick={props.onBack}>{t.back}</Button>
        </p>
      ) : (
        <p>
          {confirmed
            ? <Button disabled={!online} aria-describedby={nextHint ? hint : undefined} onClick={props.onNext}>{t.next}</Button>
            : <Button aria-describedby={hint} onClick={props.onDeclaration}>{t.toDeclaration}</Button>}
          <Button tone="quiet" onClick={props.onBack}>{t.back}</Button>
        </p>
      )}
      {!submitted && nextHint && <p id={hint}>{nextHint}</p>}
    </div>
  );
}

/** The notes as the server holds them (TODO(ugovor): without the route the block is unavailable). */
export async function loadNotes(local: LocalCall | undefined, assignmentId: string): Promise<NotesRead> {
  if (local === undefined) return { kind: "unavailable" };
  const read = await readNotes(local, assignmentId);
  return read.kind === "ready" ? read : { kind: "unavailable" };
}

/** Appends one note; the list shows it only once the server has returned it. */
export function saveNote(local: LocalCall | undefined, assignmentId: string, text: string): Promise<NoteAdded> {
  if (local === undefined) return Promise.resolve({ kind: "nepoznato" } satisfies Read<never>);
  return addNote(local, assignmentId, text);
}

export type BeforeSubmitProps = {
  readonly assignmentId: string;
  readonly summary: SummaryRead;
  readonly stage: Stage;
  /** TODO(ugovor): the transport of student.submission-notes.{get,post} (SRV-24); none until 3.1.0. */
  readonly local?: LocalCall;
};

/** The step with its state: the declaration as step 2 left it in this tab, the notes from the server. */
export default function BeforeSubmit({ assignmentId, summary, stage, local }: BeforeSubmitProps) {
  const router = useRouter();
  const online = useOnline();
  const [confirmed, setConfirmed] = useState(false);
  const [notes, setNotes] = useState<NotesRead>({ kind: "loading" });
  const [noteOpen, setNoteOpen] = useState(false);
  // Read after the first render, so the server's markup (unconfirmed) matches.
  useEffect(() => setConfirmed(readConfirmed(confirmationKey(assignmentId))), [assignmentId]);
  useEffect(() => {
    let live = true;
    void loadNotes(local, assignmentId).then((read) => { if (live) setNotes(read); });
    return () => { live = false; };
  }, [local, assignmentId]);
  const base = `/rad/${encodeURIComponent(assignmentId)}`;
  return (
    <>
      <BeforeSubmitView
        summary={summary}
        notes={notes}
        stage={stage}
        confirmed={confirmed}
        online={online}
        onNext={() => router.push(`${base}/predaja/slanje`)}
        onDeclaration={() => router.push(`${base}/predaja/izjava`)}
        onBack={() => router.push(`${base}/predaja/izjava`)}
        onReceipt={() => router.push(`${base}/predaja/potvrda`)}
        onRetry={() => router.refresh()}
        onOpenNote={() => setNoteOpen(true)}
      />
      <NoteDialog open={noteOpen} onClose={() => setNoteOpen(false)}
        onAdd={(text) => saveNote(local, assignmentId, text)}
        onAdded={(note) => setNotes((current) => current.kind === "ready" ? { kind: "ready", notes: [...current.notes, note] } : current)} />
    </>
  );
}
