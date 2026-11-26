"use client";

// PD-1 on step 3 and 5 (WEB-2108, VIZ-S4): the process summary in the prototype's panel, the eleven
// sections as `.sb-state` blocks, each marked observed or declared (Ductura_student.html, `summary()`).
import { Button, StepActions, StepDetails, StepKv, StepLine, StepLoading, StepPanel, StepSection, ToastRegion, Tag, useToasts } from "@ductura/ui";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { createApi } from "../../../../../../../src/client/api.ts";

import type { EventDisputesPort } from "../../../../../../../src/client/event-disputes.ts";
import type { SubmissionNote } from "../../../../../../../src/client/submission.ts";
import type { NotesRead, SummaryRead } from "../../../../../../../src/components/predaja/BeforeSubmit.tsx";
import type { NoteAdded } from "../../../../../../../src/components/predaja/NoteDialog.tsx";

import { EventDisputeSlot, EventDisputesProvider } from "../../event-dispute/EventDisputes";
import { summaryText as t } from "./messages.hr";
import { summaryEventId, type SummaryEventSection } from "./model";
import { LOADING_EXTRAS, readDeclarationBlocks, readExtras, type Read, type SummaryExtras } from "./extras";
import NoteForm from "./NoteForm";
import { noteText, panelSections } from "./panel-model";

export type SummaryPanelProps = {
  readonly summary: SummaryRead;
  readonly notes: NotesRead;
  readonly submitted: boolean;
  readonly confirmed: boolean;
  readonly online: boolean;
  /** The work's page: the prototype's "Prikaži mjesto u radu" and "Prikaži oznake u tekstu" go there. */
  readonly workHref: string;
  /** The kind of work, the tag beside the title. */
  readonly kind?: string;
  /** Whether the PD-4 form is open; opened by "Dodaj napomenu (nije obavezna)" on the checks too. */
  readonly noteOpen?: boolean;
  readonly onNoteOpen?: (open: boolean) => void;
  readonly onRetry: () => void;
  readonly onAddNote: (text: string) => Promise<NoteAdded>;
  readonly onNoteAdded: (note: SubmissionNote) => void;
  /**
   * The supplements and disputes of the summary's events (WEB-1305, R-08): read once for the work's
   * document and shown under each session, paste and gap. Without it the events stand alone.
   */
  readonly assignmentId?: string;
  /** Changes when the declaration was read again (the dialog closed); the declaration's blocks are then read again too. */
  readonly declarationKey?: unknown;
  readonly disputes?: { readonly port: EventDisputesPort; readonly documentId: string };
};

/** The sections the summary route does not carry, read once per assignment and work (F4-PRE-R04). */
function useExtras(assignmentId: string | undefined, documentId: string | undefined, declarationKey: unknown): SummaryExtras | undefined {
  const [extras, setExtras] = useState<SummaryExtras>(LOADING_EXTRAS);
  useEffect(() => {
    if (assignmentId === undefined || documentId === undefined) return undefined;
    let live = true;
    setExtras(LOADING_EXTRAS);
    readExtras(assignmentId, documentId, createApi(), (part) => { if (live) setExtras((now) => ({ ...now, ...part })); });
    return () => { live = false; };
  }, [assignmentId, documentId]);
  // The declaration changes inside the dialog while the ids stay: its blocks are read again, the rest is not.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return undefined; }
    if (assignmentId === undefined) return undefined;
    let live = true;
    void readDeclarationBlocks(assignmentId, createApi()).then((declaration) => { if (live) setExtras((now) => ({ ...now, declaration })); });
    return () => { live = false; };
  }, [declarationKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return assignmentId === undefined || documentId === undefined ? undefined : extras;
}

/** Loading and failure of one extra read are said as such, never as "nothing there". */
function Extra<T>({ read, fallback, children }: { read: Read<T> | undefined; fallback: string; children: (value: T) => ReactNode }) {
  if (read === undefined || read.kind === "unavailable") return <p className="note">{fallback}</p>;
  if (read.kind === "loading") return <p className="note" role="status">{t.loading}</p>;
  return <>{children(read.value)}</>;
}

const observed = <Tag>{t.observed}</Tag>;
const declared = <Tag tone="open">{t.declared}</Tag>;

/** Section 9: the notes and, before the submission, the PD-4 form (R-36, R-37). */
function Notes({ notes, submitted, online, onAddNote, onNoteAdded, noteOpen = false, onNoteOpen = () => undefined }:
  Pick<SummaryPanelProps, "notes" | "submitted" | "online" | "onAddNote" | "onNoteAdded" | "noteOpen" | "onNoteOpen">) {
  const { toasts, show, dismiss } = useToasts();
  return (
    <StepSection id="sb-notes" label={t.notes.title} heading>
        {notes.kind === "loading" && <p className="note" role="status">{t.loading}</p>}
        {notes.kind === "unavailable" && <p className="note" role="alert">{t.notes.unavailable}</p>}
        {notes.kind === "ready" && (notes.notes.length === 0 ? <p className="meta">{t.notes.none}</p>
          : notes.notes.map((note) => <StepLine key={note.id} tag={declared}>{noteText(note)}</StepLine>))}
        {!submitted && notes.kind === "ready" && noteOpen && (
          <NoteForm online={online} onAdd={onAddNote} onCancel={() => onNoteOpen(false)}
            onAdded={(note) => { onNoteAdded(note); onNoteOpen(false); show(t.notes.added); }} />
        )}
        <ToastRegion toasts={toasts} onDismiss={dismiss} label={t.notes.toastLabel} closeLabel={t.notes.toastClose} />
    </StepSection>
  );
}

/** One event and, when the panel reads marks, its supplements and disputes under it. */
function Event({ section, index, marked, children }: { section: SummaryEventSection; index: number; marked: boolean; children: ReactNode }) {
  return <>{children}{marked && <EventDisputeSlot eventId={summaryEventId(section, index)} role="student" />}</>;
}

function Part({ title, tag, children }: { title: string; tag?: ReactNode; children: ReactNode }) {
  return <StepSection label={title} heading tag={tag}>{children}</StepSection>;
}

/**
 * PD-1, the process summary (WEB-2108): eleven sections, each marked observed or declared. The same
 * text for the student and the teacher (PRODUCT §5 rule 5); nothing here holds the submission (rule 11).
 */
export default function SummaryPanel(props: SummaryPanelProps) {
  const { summary, submitted, confirmed, workHref, kind } = props;
  const notes = <Notes {...props} />;
  if (summary.kind !== "ready") {
    return (
      <StepPanel id="sb-sum-h" level={2} title={t.title} tag={kind} busy={summary.kind === "loading"}>
        {summary.kind === "loading" && <StepLoading message={t.loading} />}
        {summary.kind === "error" && <>
          <p className="note" role="alert">{t.error}</p>
          <StepActions><Button tone="secondary" onClick={props.onRetry}>{t.retry}</Button></StepActions>
        </>}
        {summary.kind === "unavailable" && <p className="note">{t.unavailable}</p>}
        {summary.kind !== "loading" && notes}
      </StepPanel>
    );
  }
  const s = panelSections(summary.summary, { submitted });
  const { disputes } = props;
  const extras = useExtras(props.assignmentId, disputes?.documentId, props.declarationKey);
  const marked = disputes !== undefined;
  const body = (
    <>
      {s.intro && <p className="note">{s.intro}</p>}
      <Part title={t.period.title} tag={observed}>
        {s.period.kind === "none" ? <p>{s.period.text}</p> : s.period.rows.map((row) => <StepKv key={row.label} label={row.label}>{row.value}</StepKv>)}
      </Part>
      <Part title={t.sessions.title} tag={observed}>
        <StepKv label={t.sessions.label}>{s.sessions.value}</StepKv>
        <p className="meta">{s.sessions.meta}</p>
        {s.sessions.list.length > 0 && <StepDetails summary={t.sessions.list}><ul className="facts">{s.sessions.list.map((line, i) => <li key={i}><Event section="sessions" index={i} marked={marked}>{line}</Event></li>)}</ul></StepDetails>}
      </Part>
      <Part title={t.editing.title} tag={observed}>
        <StepKv label={s.editing.label}>{s.editing.value}</StepKv>
        <p className="note">{t.editing.note}</p>
      </Part>
      <Part title={t.versions.title} tag={observed}>
        <Extra read={extras?.versions} fallback={t.versions.unavailable}>{(v) => v.lines.length === 0 ? <p>{t.versions.none}</p> : (
          <><ul className="facts">{v.lines.map((line, i) => <li key={i}>{line}</li>)}</ul>{v.more && <p className="meta">{t.versions.more}</p>}</>
        )}</Extra>
      </Part>
      <Part title={t.pastes.title}>
        {s.pastes.items.length === 0 ? <p>{t.pastes.none}</p> : (
          <ul className="list">{s.pastes.items.map((line, i) => (
            <li key={i} className="item">
              <Event section="pastes" index={i} marked={marked}>
                <StepLine tag={observed}>{line}</StepLine>
                <span className="note">{t.pastes.origin}</span>
                <a href={workHref}>{t.pastes.place}</a>
              </Event>
            </li>
          ))}</ul>
        )}
        <p className="meta">{s.pastes.meta}</p>
      </Part>
      <Part title={t.assistant.title}>
        <Extra read={extras?.assistant} fallback={t.assistant.unavailable}>{(a) => (
          <>
            <p>{a.enabled ? t.assistant.enabled : t.assistant.disabled}</p>
            {a.enabled && (a.lines.length === 0 ? <p>{t.assistant.none}</p> : <ul className="facts">{a.lines.map((line, i) => <li key={i}>{line}</li>)}</ul>)}
          </>
        )}</Extra>
        <p className="meta">{t.assistant.meta}</p>
      </Part>
      <Part title={t.gaps.title} tag={observed}>
        {s.gaps.items.length === 0 ? <p>{t.gaps.none}</p> : <ul className="facts">{s.gaps.items.map((line, i) => <li key={i}><Event section="gaps" index={i} marked={marked}>{line}</Event></li>)}</ul>}
        {s.gaps.hint && <p className="meta">{s.gaps.hint}</p>}
      </Part>
      <Part title={t.declaration.title}>
        {confirmed || submitted ? <>
          <p className="meta">{t.declaration.confirmed}</p>
          <Extra read={extras?.declaration} fallback={t.declaration.detailsUnavailable}>{(blocks) => blocks === null
            ? <p className="note">{t.declaration.detailsUnavailable}</p>
            : <>
              <StepSection label={t.declaration.recordedTitle} heading>{blocks.recorded.map((line, i) => <p key={i}>{line}</p>)}</StepSection>
              <StepSection label={t.declaration.studentTitle} heading>{blocks.student.map((line, i) => <p key={i}>{line}</p>)}</StepSection>
            </>}</Extra>
        </> : <p>{t.declaration.missing}</p>}
      </Part>
      {notes}
      <Part title={t.record.title} tag={observed}>
        <p>{s.record.state}</p>
        {s.record.unchanged && <p className="meta">{s.record.unchanged}</p>}
      </Part>
      <Part title={t.provenance.title}>
        <Extra read={extras?.provenance} fallback={t.provenance.unavailable}>{(p) => (
          <>
            <StepSection label={t.provenance.sharesTitle} heading><ul className="facts">{p.shares.map((line, i) => <li key={i}>{line}</li>)}</ul></StepSection>
            <StepSection label={t.provenance.marksTitle} heading>
              {p.marks.length === 0 ? <p>{t.provenance.none}</p> : <ul className="facts">{p.marks.map((line, i) => <li key={i}>{line}</li>)}</ul>}
            </StepSection>
            <p className="meta">{t.provenance.notice}</p>
          </>
        )}</Extra>
        <p className="meta">{t.provenance.meta}</p>
        <a href={workHref}>{t.provenance.link}</a>
      </Part>
    </>
  );
  return (
    <StepPanel id="sb-sum-h" level={2} title={t.title} tag={kind}>
      {disputes === undefined ? body
        : <EventDisputesProvider port={disputes.port} documentId={disputes.documentId}>{body}</EventDisputesProvider>}
    </StepPanel>
  );
}
