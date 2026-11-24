"use client";

import { Button, StepActions, StepDecl, TextArea } from "@ductura/ui";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { NOTE_MAX, type SubmissionNote } from "../../../../../../../src/client/submission.ts";
import { noteFailure, noteProblem, type NoteAdded } from "../../../../../../../src/components/predaja/NoteDialog.tsx";

import { summaryText } from "./messages.hr";

const t = summaryText.notes;

export type NoteFormProps = {
  readonly online: boolean;
  /** The append; the form closes only on the server's note (append only, no edit, no delete). */
  readonly onAdd: (text: string) => Promise<NoteAdded>;
  readonly onAdded: (note: SubmissionNote) => void;
  readonly onCancel: () => void;
};

/**
 * PD-4 "Napomena uz rad", inline in section 9 of the summary. It opens with
 * the focus in the field; a blank text marks the field invalid and keeps the
 * focus there (R-36).
 */
export default function NoteForm({ online, onAdd, onAdded, onCancel }: NoteFormProps) {
  const field = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  // NF-3 PR-6 (E-8d, R-66): an answer that did not add the note is an alert of its own, not a field error.
  const [failure, setFailure] = useState<string>();
  const [sending, setSending] = useState(false);
  useEffect(() => { field.current?.focus(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const problem = noteProblem(text);
    if (problem !== undefined) {
      setError(problem);
      field.current?.focus();
      return;
    }
    setSending(true);
    setFailure(undefined);
    const result = await onAdd(text.trim());
    setSending(false);
    if (result.kind === "added") onAdded(result.note);
    else {
      // The server's 422 is about the text; anything else leaves it unknown whether the note was added.
      if (result.kind === "greska" && result.code === "invalid") setError(noteFailure(result));
      else setFailure(noteFailure(result));
      field.current?.focus();
    }
  }

  return (
    <StepDecl own onSubmit={(event) => void submit(event)}>
      <TextArea ref={field} label={t.label} name="note" maxLength={NOTE_MAX} value={text} busy={sending}
        error={error} hint={online ? t.hint : t.offline}
        onChange={(event) => { setText(event.currentTarget.value); if (error !== undefined) setError(undefined); }} />
      <p className="meta">{t.seenBy}</p>
      {failure !== undefined && <p className="note" role="alert">{failure}</p>}
      <StepActions>
        <Button type="submit" aria-disabled={!online || undefined} busy={sending}>{sending ? t.sending : t.add}</Button>
        <Button type="button" tone="secondary" onClick={onCancel}>{t.cancel}</Button>
      </StepActions>
    </StepDecl>
  );
}
