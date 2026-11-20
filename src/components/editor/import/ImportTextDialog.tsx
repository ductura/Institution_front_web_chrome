"use client";

import { useState } from "react";
import { Button, Checkbox, Dialog, TextArea } from "@ductura/ui";

import { importMessages as t } from "./messages.hr";
import { IMPORT_MAX_CHARS, isRefusal, isTextFile, prepareImport, type TextImport } from "./text-import";

type Props = {
  /** Called once with the validated import; the editor marks the inserted text as imported. */
  onImport: (result: TextImport) => void;
  onClose: () => void;
  now?: () => Date;
};

/** Mount on opening. Nothing is inserted until the declaration is ticked. */
export function ImportTextDialog({ onImport, onClose, now = () => new Date() }: Props) {
  const [text, setText] = useState("");
  const [declared, setDeclared] = useState(false);
  const [error, setError] = useState("");

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    if (!isTextFile(file)) return setError(t.badFile);
    if (file.size > IMPORT_MAX_CHARS * 4) return setError(t.tooLarge);
    setError("");
    setText(await file.text());
  };
  const submit = () => {
    const result = prepareImport(text, declared, now());
    if (isRefusal(result)) return setError(t[result]);
    onImport(result);
    onClose();
  };

  return (
    <Dialog open title={t.title} onClose={onClose} actions={<>
      <Button tone="quiet" onClick={onClose}>{t.cancel}</Button>
      <Button onClick={submit}>{t.submit}</Button>
    </>}>
      <p>{t.note}</p>
      <TextArea label={t.body} hint={t.bodyHint} value={text} rows={8} onChange={(event) => { setText(event.target.value); setError(""); }} />
      <label>{t.file} <input type="file" accept=".txt,.md,text/plain,text/markdown"
        onChange={(event) => { void readFile(event.target.files?.[0]); event.target.value = ""; }} /></label>
      <Checkbox label={t.declaration} checked={declared} onChange={(event) => { setDeclared(event.target.checked); setError(""); }} />
      <p role="alert">{error}</p>
    </Dialog>
  );
}
