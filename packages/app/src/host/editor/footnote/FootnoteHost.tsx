"use client";

// WEB-2125: dijalozi Fusnota i Unakrsna poveznica u ljusci uređivača. Host ne
// dira dokument: shell daje povratne pozive koji primjenjuju izmjenu.
import { useState } from "react";
import { Button, Dialog, Select, TextArea } from "@ductura/ui";
import type { Node as PmNode } from "@tiptap/pm/model";

import { crossReferenceTargets, prepareFootnoteText } from "./footnote-model";
import { crossReferenceHr as cr, footnoteHr as t } from "./messages.hr";

type Note = { readonly number: number; readonly text: string };

export type FootnoteDialogHostProps = { onClose: () => void } & (
  | { mode: "insert"; onSave: (text: string) => boolean }
  | { mode: "read"; note: Note }
  | { mode: "edit"; note: Note; onSave: (text: string) => boolean; onRemove: () => boolean }
);

export function FootnoteDialogHost(props: FootnoteDialogHostProps) {
  const note = props.mode === "insert" ? null : props.note;
  const [editing, setEditing] = useState(props.mode === "insert");
  const [text, setText] = useState(note?.text ?? "");
  const [error, setError] = useState<string>();
  const showField = props.mode !== "read" && editing;
  const prepared = showField ? prepareFootnoteText(text) : null;
  const finish = (applied: boolean) => (applied ? props.onClose() : setError(t.unavailable));

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

export type CrossReferenceDialogHostProps = { document: PmNode; onClose: () => void } & (
  | { mode: "insert"; onInsert: (targetId: string) => boolean }
  | { mode: "read"; targetId: string; onFollow: (targetId: string) => void; onRemove?: () => boolean }
);

export function CrossReferenceDialogHost(props: CrossReferenceDialogHostProps) {
  const [selection, setSelection] = useState("");
  const [error, setError] = useState<string>();
  const targets = crossReferenceTargets(props.document);
  const selectedId = props.mode === "insert" ? selection : props.targetId;
  const target = targets.find((c) => c.id === selectedId);
  const remove = props.mode === "read" ? props.onRemove : undefined;
  const finish = (applied: boolean) => (applied ? props.onClose() : setError(cr.unavailable));

  return (
    <Dialog open title={cr.title} error={error} onClose={props.onClose} actions={<>
      <Button tone="quiet" onClick={props.onClose}>{cr.close}</Button>
      {props.mode === "insert"
        ? <Button disabled={!target} onClick={() => { if (target) finish(props.onInsert(target.id)); }}>{cr.insert}</Button>
        : <>
            {remove && <Button tone="quiet" onClick={() => finish(remove())}>{cr.remove}</Button>}
            {target && <Button onClick={() => props.onFollow(target.id)}>{cr.follow}</Button>}
          </>}
    </>}>
      {props.mode === "read"
        ? <p>{target ? target.label : cr.missing}</p>
        : targets.length === 0
          ? <p>{cr.empty}</p>
          : <>
              <Select label={cr.target} placeholder={cr.choose} hint={cr.hint} value={target ? selectedId : ""}
                options={targets.map((c) => ({ value: c.id, label: c.label }))}
                onChange={(event) => { setSelection(event.target.value); setError(undefined); }} />
              <p>{cr.displaysUnavailable}</p>
            </>}
    </Dialog>
  );
}
