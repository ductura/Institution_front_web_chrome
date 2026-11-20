"use client";

import { useState } from "react";
import { Button, Dialog, TextField } from "@ductura/ui";

import type { CoverFields } from "./cover";
import { pagesMessages as t } from "./messages.hr";

type Props = {
  value: CoverFields;
  /** Cover rules from the faculty profile; empty shows the general-layout note. */
  rules: readonly string[];
  onApply: (fields: CoverFields) => void;
  onClose: () => void;
};

/** Mount on opening. Edits stay a draft until "Gotovo". */
export function CoverDialog({ value, rules, onApply, onClose }: Props) {
  const [draft, setDraft] = useState(value);
  const field = (key: keyof CoverFields, label: string, hint?: string) => (
    <TextField label={label} hint={hint} value={draft[key]} maxLength={120}
      onChange={(event) => setDraft((previous) => ({ ...previous, [key]: event.target.value }))} />
  );
  return (
    <Dialog open title={t.coverTitle} onClose={onClose} actions={<>
      <Button tone="quiet" onClick={onClose}>{t.cancel}</Button>
      <Button onClick={() => { onApply(draft); onClose(); }}>{t.done}</Button>
    </>}>
      <p>{t.coverNote}</p>
      {field("student", t.student, t.studentHint)}
      {field("mentor", t.mentor, t.mentorHint)}
      {field("study", t.study, t.studyHint)}
      {field("place", t.place)}
      {field("date", t.date)}
      <h3>{t.coverRules}</h3>
      {rules.length > 0 ? <ul>{rules.map((rule) => <li key={rule}>{rule}</li>)}</ul> : <p>{t.coverGeneral}</p>}
    </Dialog>
  );
}
