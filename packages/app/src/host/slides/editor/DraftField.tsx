"use client";

// WEB-V13-UREDNIK: a text field that keeps what the person types while it has
// focus, even when the document holds a trimmed or refused version of it, so a
// refused change never eats the text. On blur, and after undo or redo, it
// shows the document's text again.
import { useState } from "react";
import { TextArea, TextField } from "@ductura/ui";

export type DraftFieldProps = {
  label: string;
  /** The document's text; "" when there is none. */
  value: string;
  multiline: boolean;
  readOnly: boolean;
  hint?: string;
  error?: string;
  /** Changes when undo or redo replaced the document: the draft is dropped, the element stays (and keeps focus). */
  epoch?: number;
  onChange: (raw: string) => void;
};

export function DraftField({ label, value, multiline, readOnly, hint, error, epoch = 0, onChange }: DraftFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [seen, setSeen] = useState(epoch);
  if (seen !== epoch) {
    setSeen(epoch);
    setDraft(null);
  }
  const shown = draft ?? value;
  const change = (raw: string) => {
    setDraft(raw);
    onChange(raw);
  };
  const common = { label, value: shown, readOnly, hint, error, onBlur: () => setDraft(null) };
  return multiline
    ? <TextArea {...common} rows={4} onChange={(event) => change(event.target.value)} />
    : <TextField {...common} onChange={(event) => change(event.target.value)} />;
}
