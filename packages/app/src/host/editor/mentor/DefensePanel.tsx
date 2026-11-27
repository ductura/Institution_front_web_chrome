"use client";

// ED-121 (prototype tools.js, dialog "obrana"): "Kostur za obranu" in the Mentor card. The outline is
// composed from the work when nothing was edited yet; the student's edits stay on this device, per work,
// and "Složi ponovno iz rada" composes it again (and forgets the edits).
import { ActionRow, Button, TextArea } from "@ductura/ui";
import { useState } from "react";

import type { NoteStorage } from "../assist/work-notes";
import { loadDefense, MAX_DEFENSE, saveDefense } from "./defense-model";
import { mentorCardHr } from "./messages.hr";

const t = mentorCardHr.defense;

type Note = "copied" | "copyFailed" | null;

export function DefensePanel({ workId, compose, storage, onCopy }: {
  workId: string;
  /** The outline as the work reads now. */
  compose: () => string;
  storage: NoteStorage | null;
  onCopy?: (text: string) => Promise<boolean>;
}) {
  const [text, setText] = useState(() => loadDefense(storage, workId) ?? compose());
  const [note, setNote] = useState<Note>(null);

  const edit = (next: string) => { setText(next); setNote(null); saveDefense(storage, workId, next); };
  const redo = () => { saveDefense(storage, workId, null); setText(compose()); setNote(null); };
  const copy = async () => {
    const ok = await (onCopy?.(text) ?? Promise.resolve(false)).catch(() => false);
    setNote(ok ? "copied" : "copyFailed");
  };

  return (
    <div data-defense-panel="">
      <p>{t.intro}</p>
      <TextArea label={t.edit} rows={14} maxLength={MAX_DEFENSE} value={text} onChange={(e) => edit(e.currentTarget.value)} />
      <ActionRow>
        <Button size="dense" tone="quiet" onClick={redo}>{t.redo}</Button>
        {onCopy && <Button size="dense" tone="secondary" onClick={() => void copy()}>{t.copy}</Button>}
      </ActionRow>
      <p>{t.stays}</p>
      {note === "copied" && <p role="status">{t.copied}</p>}
      {note === "copyFailed" && <p role="alert">{t.copyFailed}</p>}
    </div>
  );
}
