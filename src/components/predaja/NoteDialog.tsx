"use client";

import { Button, Dialog, TextArea } from "@ductura/ui";
import { useState } from "react";

import { NOTE_MAX, type Read, type SubmissionNote } from "../../client/submission";
import { messagesHr } from "../../lib/i18n/messages.hr";

const t = messagesHr.beforeSubmit;

export type NoteAdded = Read<{ readonly kind: "added"; readonly note: SubmissionNote }>;

/** What keeps a note from being sent: blank, or over 600 characters as the contract counts them. */
export function noteProblem(text: string): string | undefined {
  if (text.trim() === "") return t.noteEmpty;
  if ([...text].length > NOTE_MAX) return t.noteTooLong;
  return undefined;
}

/** The dialog's line for an answer that did not add the note; never "added" without the server's note. */
export function noteFailure(result: NoteAdded): string | undefined {
  switch (result.kind) {
    case "added": return undefined;
    case "session-expired": return t.noteExpired;
    case "greska": return result.code === "invalid" ? t.noteTooLong : t.noteRefused;
    default: return t.noteUnknown;
  }
}

export type NoteDialogProps = {
  readonly open: boolean;
  readonly onClose: () => void;
  /** The append: the dialog closes only on the server's note (PD-4, append only). */
  readonly onAdd: (text: string) => Promise<NoteAdded>;
  readonly onAdded: (note: SubmissionNote) => void;
  /** False only in the catalogue, where the dialog stands in the page like the Dialog entry. */
  readonly modal?: boolean;
};

/**
 * PD-4 "Dodaj napomenu (nije obavezna)": up to 600 characters, append only.
 * An empty or too long note is marked on the field (`aria-invalid`) and not
 * sent. While the note is sent the buttons do nothing and Escape does not
 * close the dialog.
 */
export function NoteDialog({ open, onClose, onAdd, onAdded, modal = true }: NoteDialogProps) {
  const [text, setText] = useState("");
  const [fieldError, setFieldError] = useState<string>();
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);

  const close = () => {
    setText("");
    setFieldError(undefined);
    setError(undefined);
    onClose();
  };

  const add = async () => {
    if (sending) return;
    const problem = noteProblem(text);
    setFieldError(problem);
    if (problem !== undefined) return;
    setSending(true);
    setError(undefined);
    const result = await onAdd(text);
    setSending(false);
    if (result.kind === "added") {
      onAdded(result.note);
      close();
      return;
    }
    setError(noteFailure(result));
  };

  return (
    <Dialog open={open} modal={modal} title={t.noteTitle} onClose={close} dismissible={!sending} error={error}
      actions={(
        <>
          <Button busy={sending} onClick={() => void add()}>{sending ? t.noteSending : t.noteAdd}</Button>
          <Button tone="quiet" busy={sending} onClick={close}>{t.noteCancel}</Button>
        </>
      )}>
      <TextArea label={t.noteLabel} hint={`${t.noteHint} ${[...text].length}/${NOTE_MAX}`} error={fieldError}
        value={text} busy={sending} onChange={(event) => {
          setText(event.currentTarget.value);
          if (fieldError !== undefined) setFieldError(noteProblem(event.currentTarget.value));
        }} />
    </Dialog>
  );
}
