"use client";

import { Button, Card, Details, KeyValueList, Tag, ToastRegion, useToasts } from "@ductura/ui";
import { useState, type ReactNode } from "react";

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
  readonly onRetry: () => void;
  readonly onAddNote: (text: string) => Promise<NoteAdded>;
  readonly onNoteAdded: (note: SubmissionNote) => void;
};

const observed = <Tag>{t.observed}</Tag>;
const declared = <Tag tone="accent">{t.declared}</Tag>;

function Part({ title, tag, children }: { title: string; tag?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <h3>{title} {tag}</h3>
      {children}
    </section>
  );
}

/** Section 9: the notes and, before the submission, the PD-4 form (R-36, R-37). */
function Notes({ notes, submitted, online, onAddNote, onNoteAdded }: Pick<SummaryPanelProps, "notes" | "submitted" | "online" | "onAddNote" | "onNoteAdded">) {
  const [open, setOpen] = useState(false);
  const { toasts, show, dismiss } = useToasts();
  return (
    <Part title={t.notes.title}>
      {notes.kind === "loading" && <p role="status">{t.loading}</p>}
      {notes.kind === "unavailable" && <p role="alert">{t.notes.unavailable}</p>}
      {notes.kind === "ready" && (notes.notes.length === 0 ? <p>{t.notes.none}</p>
        : <ul>{notes.notes.map((note) => <li key={note.id}>{noteText(note)} {declared}</li>)}</ul>)}
      {!submitted && notes.kind === "ready" && (open
        ? <NoteForm online={online} onAdd={onAddNote} onCancel={() => setOpen(false)}
          onAdded={(note) => { onNoteAdded(note); setOpen(false); show(t.notes.added); }} />
        : <p><Button tone="quiet" disabled={!online} onClick={() => setOpen(true)}>{t.notes.open}</Button></p>)}
      <ToastRegion toasts={toasts} onDismiss={dismiss} label={t.notes.toastLabel} closeLabel={t.notes.toastClose} />
    </Part>
  );
}

/**
 * PD-1, the process summary on step 3 (WEB-2108): eleven sections, each
 * marked observed or declared. The same text for the student and the teacher
 * (PRODUCT §5 rule 5); nothing here holds the submission (rule 11).
 */
export default function SummaryPanel(props: SummaryPanelProps) {
  const { summary, submitted, confirmed, workHref } = props;
  const notes = <Notes {...props} />;
  if (summary.kind !== "ready") {
    return (
      <Card title={t.title}>
        {summary.kind === "loading" && <p role="status">{t.loading}</p>}
        {summary.kind === "error" && <>
          <p role="alert">{t.error}</p>
          <p><Button tone="quiet" onClick={props.onRetry}>{t.retry}</Button></p>
        </>}
        {summary.kind === "unavailable" && <p>{t.unavailable}</p>}
        {summary.kind !== "loading" && notes}
      </Card>
    );
  }
  const s = panelSections(summary.summary, { submitted });
  return (
    <Card title={t.title}>
      {s.intro && <p>{s.intro}</p>}
      <Part title={t.period.title} tag={observed}>
        {s.period.kind === "none" ? <p>{s.period.text}</p>
          : <KeyValueList items={s.period.rows.map((row) => ({ id: row.label, label: row.label, value: row.value }))} />}
      </Part>
      <Part title={t.sessions.title} tag={observed}>
        <KeyValueList items={[{ id: "sessions", label: t.sessions.label, value: s.sessions.value }]} />
        <p>{s.sessions.meta}</p>
        {s.sessions.list.length > 0 && <Details summary={t.sessions.list}><ul>{s.sessions.list.map((line, i) => <li key={i}>{line}</li>)}</ul></Details>}
      </Part>
      <Part title={t.editing.title} tag={observed}>
        <KeyValueList items={[{ id: "editing", label: s.editing.label, value: s.editing.value }]} />
        <p>{t.editing.note}</p>
      </Part>
      <Part title={t.versions.title} tag={observed}>
        <p>{t.versions.unavailable}</p>
      </Part>
      <Part title={t.pastes.title}>
        {s.pastes.items.length === 0 ? <p>{t.pastes.none}</p> : (
          <ul>{s.pastes.items.map((line, i) => (
            <li key={i}>{line} {observed} <span>{t.pastes.origin}</span> <a href={workHref}>{t.pastes.place}</a></li>
          ))}</ul>
        )}
        <p>{s.pastes.meta}</p>
      </Part>
      <Part title={t.assistant.title}>
        <p>{t.assistant.unavailable}</p>
        <p>{t.assistant.meta}</p>
      </Part>
      <Part title={t.gaps.title} tag={observed}>
        {s.gaps.items.length === 0 ? <p>{t.gaps.none}</p> : <ul>{s.gaps.items.map((line, i) => <li key={i}>{line}</li>)}</ul>}
        {s.gaps.hint && <p>{s.gaps.hint}</p>}
      </Part>
      <Part title={t.declaration.title} tag={confirmed || submitted ? declared : undefined}>
        {confirmed || submitted ? <><p>{t.declaration.confirmed}</p><p>{t.declaration.detailsUnavailable}</p></>
          : <p>{t.declaration.missing}</p>}
      </Part>
      {notes}
      <Part title={t.record.title} tag={observed}>
        <p>{s.record.state}</p>
        {s.record.unchanged && <p>{s.record.unchanged}</p>}
      </Part>
      <Part title={t.provenance.title}>
        <p>{t.provenance.meta}</p>
        <a href={workHref}>{t.provenance.link}</a>
      </Part>
    </Card>
  );
}
