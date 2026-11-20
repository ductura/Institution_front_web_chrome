"use client";

import { useState } from "react";
import { Button, Dialog, TextArea } from "@ductura/ui";

import { footnoteText } from "./footnote-text";
import { footnoteMessages as t } from "./messages.hr";

type Footnote = { readonly number: number; readonly text: string };

type FootnoteDialogProps = {
  onClose: () => void;
} & (
  | { mode: "insert"; onSave: (text: string) => boolean }
  | { mode: "read"; note: Footnote }
  | { mode: "edit"; note: Footnote; onSave: (text: string) => boolean; onRemove: () => boolean }
);

/** Mount for each open note. Callbacks apply the edit to the active document. */
export function FootnoteDialog(props: FootnoteDialogProps) {
  const note = props.mode === "insert" ? null : props.note;
  const [editing, setEditing] = useState(props.mode === "insert");
  const [text, setText] = useState(note?.text ?? "");
  const [error, setError] = useState<string>();
  const canWrite = props.mode !== "read";
  const showField = canWrite && editing;
  const prepared = showField ? footnoteText(text) : null;

  function finish(applied: boolean) {
    if (applied) props.onClose();
    else setError(t.unavailable);
  }

  return (
    <Dialog open title={note ? `${t.title} ${note.number}` : t.title} error={error} onClose={props.onClose}
      actions={<>
        <Button tone="quiet" onClick={props.onClose}>{showField ? t.cancel : t.close}</Button>
        {showField &&
          <Button disabled={prepared === null || (props.mode === "insert" && prepared === "")}
            onClick={() => {
              if (prepared === null) return;
              if (prepared !== "") finish(props.onSave(prepared));
              else if (props.mode === "edit") finish(props.onRemove());
            }}>
            {props.mode === "insert" ? t.insert : prepared === "" ? t.remove : t.save}
          </Button>}
        {props.mode === "edit" && !showField && <>
          <Button tone="quiet" onClick={() => finish(props.onRemove())}>{t.remove}</Button>
          <Button onClick={() => { setText(props.note.text); setError(undefined); setEditing(true); }}>{t.edit}</Button>
        </>}
      </>}>
      {showField
        ? <TextArea autoFocus label={t.text} hint={t.hint} error={prepared === null ? t.invalidText : undefined} value={text}
            onChange={(event) => { setText(event.target.value); setError(undefined); }} />
        : <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{note?.text || t.empty}</p>}
    </Dialog>
  );
}
