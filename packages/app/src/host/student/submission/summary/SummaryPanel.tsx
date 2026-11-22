"use client";

// PD-1 on step 3 and 5 (WEB-2108, VIZ-S4): the process summary in the prototype's panel, the eleven
// sections as `.sb-state` blocks, each marked observed or declared (Ductura_student.html, `summary()`).
import { Button, Details, StepActions, StepKv, StepLine, StepLoading, StepPanel, StepSection, ToastRegion, Tag, useToasts } from "@ductura/ui";
import type { ReactNode } from "react";

import type { SubmissionNote } from "../../../../../../../src/client/submission.ts";
import type { NotesRead, SummaryRead } from "../../../../../../../src/components/predaja/BeforeSubmit.tsx";
import type { NoteAdded } from "../../../../../../../src/components/predaja/NoteDialog.tsx";

import { summaryText as t } from "./messages.hr";
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
};

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
  return (
    <StepPanel id="sb-sum-h" level={2} title={t.title} tag={kind}>
      {s.intro && <p className="note">{s.intro}</p>}
      <Part title={t.period.title} tag={observed}>
        {s.period.kind === "none" ? <p>{s.period.text}</p> : s.period.rows.map((row) => <StepKv key={row.label} label={row.label}>{row.value}</StepKv>)}
      </Part>
      <Part title={t.sessions.title} tag={observed}>
        <StepKv label={t.sessions.label}>{s.sessions.value}</StepKv>
        <p className="meta">{s.sessions.meta}</p>
        {s.sessions.list.length > 0 && <Details summary={t.sessions.list}><ul className="facts">{s.sessions.list.map((line, i) => <li key={i}>{line}</li>)}</ul></Details>}
      </Part>
      <Part title={t.editing.title} tag={observed}>
        <StepKv label={s.editing.label}>{s.editing.value}</StepKv>
        <p className="note">{t.editing.note}</p>
      </Part>
      <Part title={t.versions.title} tag={observed}>
        <p className="note">{t.versions.unavailable}</p>
      </Part>
      <Part title={t.pastes.title}>
        {s.pastes.items.length === 0 ? <p>{t.pastes.none}</p> : (
          <ul className="list">{s.pastes.items.map((line, i) => (
            <li key={i} className="item">
              <StepLine tag={observed}>{line}</StepLine>
              <span className="note">{t.pastes.origin}</span>
              <a href={workHref}>{t.pastes.place}</a>
            </li>
          ))}</ul>
        )}
        <p className="meta">{s.pastes.meta}</p>
      </Part>
      <Part title={t.assistant.title}>
        <p className="note">{t.assistant.unavailable}</p>
        <p className="meta">{t.assistant.meta}</p>
      </Part>
      <Part title={t.gaps.title} tag={observed}>
        {s.gaps.items.length === 0 ? <p>{t.gaps.none}</p> : <ul className="facts">{s.gaps.items.map((line, i) => <li key={i}>{line}</li>)}</ul>}
        {s.gaps.hint && <p className="meta">{s.gaps.hint}</p>}
      </Part>
      <Part title={t.declaration.title}>
        {confirmed || submitted ? <><p className="meta">{t.declaration.confirmed}</p><p className="note">{t.declaration.detailsUnavailable}</p></>
          : <p>{t.declaration.missing}</p>}
      </Part>
      {notes}
      <Part title={t.record.title} tag={observed}>
        <p>{s.record.state}</p>
        {s.record.unchanged && <p className="meta">{s.record.unchanged}</p>}
      </Part>
      <Part title={t.provenance.title}>
        <p className="meta">{t.provenance.meta}</p>
        <a href={workHref}>{t.provenance.link}</a>
      </Part>
    </StepPanel>
  );
}
